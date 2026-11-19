// Live Studio's "program" picture and sound: what actually goes out on the stream.
//
// Everything is drawn onto one 1280x720 canvas: the current scene (live camera/screen in a
// layout, a countdown, or a title card), then the background, logo, overlay, lower third,
// ticker, and QR code on top. The microphone, any screen/tab audio, and music are mixed into
// one audio track. The canvas and the mix are what get sent out, so the preview on the page is
// exactly what viewers see.
//
// The draw loop is driven by a Web Worker timer, not requestAnimationFrame: browsers pause
// animation frames in background tabs, and when someone shares another tab or window this
// page usually is in the background. Without this the stream would freeze.
//
// Every image drawn here must be same-origin (data: URLs or /images/...). A picture from
// another site would "taint" the canvas and the browser would stop the stream.

export const WIDTH = 1280;
export const HEIGHT = 720;
const FPS = 30;

// Icons are drawn from these boxes (fractions of the frame) in the layout picker
export const LAYOUTS = [
  { id: 'camera', label: 'Camera only', boxes: [[0, 0, 1, 1]] },
  { id: 'screen', label: 'Screen only', boxes: [[0, 0, 1, 1]], needsScreen: true },
  { id: 'pip', label: 'Screen with camera in the corner', boxes: [[0, 0, 1, 1], [0.7, 0.66, 0.26, 0.28]], needsScreen: true },
  { id: 'side', label: 'Screen large, camera beside', boxes: [[0, 0.1, 0.66, 0.8], [0.69, 0.25, 0.31, 0.5]], needsScreen: true },
  { id: 'split', label: 'Screen and camera, same size', boxes: [[0, 0.2, 0.49, 0.6], [0.51, 0.2, 0.49, 0.6]], needsScreen: true },
  { id: 'splitTall', label: 'Screen and camera, equal halves (full height)', boxes: [[0, 0, 0.49, 1], [0.51, 0, 0.49, 1]], needsScreen: true },
  { id: 'cameraPip', label: 'Camera with screen in the corner', boxes: [[0, 0, 1, 1], [0.7, 0.66, 0.26, 0.28]], needsScreen: true }
];

const NAVY = '#10295e';
const NAVY_DEEP = '#0b1d44';
const RED = '#e6252e';
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

export const loadImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const makeTicker = (onTick) => {
  const source = 'let id=null;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  worker.onmessage = onTick;
  worker.postMessage(Math.round(1000 / FPS));
  return () => {
    worker.postMessage(0);
    worker.terminate();
    URL.revokeObjectURL(url);
  };
};

const makeMedia = (host, tag) => {
  const el = document.createElement(tag);
  if (tag === 'video') {
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
  }
  // Kept in the page (but invisible) so the browser keeps decoding frames
  el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
  host.appendChild(el);
  return el;
};

const hasFrame = (video) => video.srcObject && video.readyState >= 2 && video.videoWidth > 0;

// Draw a picture into the box: 'cover' fills it (cropping), 'contain' shows all of it
// mirror: flip left-to-right (like looking in a mirror)
const drawFit = (ctx, src, sw, sh, x, y, w, h, fit, mirror = false) => {
  const scale = fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (mirror) {
    ctx.translate(x * 2 + w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
};

const roundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Text that shrinks to fit a width
const fitFont = (ctx, text, weight, size, maxWidth) => {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 14 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
};

// Whether a #rrggbb color is dark (so its glow should be light)
const isDark = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.5;
};

export const formatCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

export class StudioMixer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext('2d');
    this.host = document.createElement('div');
    document.body.appendChild(this.host);
    this.cameraVideo = makeMedia(this.host, 'video');
    this.screenVideo = makeMedia(this.host, 'video');
    this.musicEl = makeMedia(this.host, 'audio');
    // Video clips (intros, outros): full screen with their own sound, into the stream only
    this.clipEl = makeMedia(this.host, 'video');
    this.clipEl.muted = false;
    this.clipPlaying = false;
    this.churchLogo = null;
    loadImage('/images/logo.png').then((img) => { this.churchLogo = img; });

    // What to show. Set with set({...}) from the page.
    this.state = {
      scene: { kind: 'live' },   // { kind: 'live' | 'countdown' | 'card', text, endsAt }
      layout: 'camera',
      swap: false,              // trade the camera and screen boxes in two-box layouts
      mirrorCamera: false,      // flip the camera left-to-right
      tickerSpeed: 110,         // pixels per second
      chatShown: null,          // { author, text, platform }: a chat message shown on screen
      cameraRadius: 12,         // corner rounding for the camera box (pixels)
      screenRadius: 12,         // corner rounding for the screen box (pixels)
      cameraShape: 'rect',      // camera box: 'rect' | 'square' | 'circle'
      placement: {},            // per layout: { pos: 'right-center', size: 30 } (Style window)
      background: null,         // Image
      logo: null,               // Image (top-left corner)
      overlay: null,            // Image (full frame, usually a transparent PNG)
      lowerThird: null,         // { title, subtitle }
      ticker: null,             // { text, startedAt }
      qr: null                  // { image, label }
    };

    this.audio = new AudioContext();
    this.audioOut = this.audio.createMediaStreamDestination();
    this.micGain = this.audio.createGain();
    this.micGain.connect(this.audioOut);
    this.micAnalyser = this.audio.createAnalyser();
    this.micAnalyser.fftSize = 512;
    this.micGain.connect(this.micAnalyser);
    this.screenGain = this.audio.createGain();
    this.screenGain.connect(this.audioOut);
    this.musicGain = this.audio.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.audioOut);
    this.musicSource = this.audio.createMediaElementSource(this.musicEl);
    this.musicSource.connect(this.musicGain);
    this.clipGain = this.audio.createGain();
    this.clipGain.connect(this.audioOut);
    this.clipSource = this.audio.createMediaElementSource(this.clipEl);
    this.clipSource.connect(this.clipGain);
    this.micSource = null;
    this.screenSource = null;
    this.levelBuffer = new Uint8Array(this.micAnalyser.fftSize);

    this.output = this.canvas.captureStream(FPS);
    this.stopTicker = makeTicker(() => this.draw());
    this.draw();
  }

  get videoTrack() { return this.output.getVideoTracks()[0]; }
  get audioTrack() { return this.audioOut.stream.getAudioTracks()[0]; }

  // Browsers start audio suspended until the person clicks something
  resumeAudio() {
    if (this.audio.state === 'suspended') this.audio.resume().catch(() => {});
  }

  set(changes) { this.state = { ...this.state, ...changes }; }

  setCamera(stream) {
    this.cameraVideo.srcObject = stream;
    if (stream) this.cameraVideo.play().catch(() => {});
  }

  setScreen(stream) {
    this.screenVideo.srcObject = stream;
    if (stream) this.screenVideo.play().catch(() => {});
    if (this.screenSource) {
      this.screenSource.disconnect();
      this.screenSource = null;
    }
    if (stream && stream.getAudioTracks().length > 0) {
      this.screenSource = this.audio.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      this.screenSource.connect(this.screenGain);
    }
  }

  setMic(stream) {
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (stream && stream.getAudioTracks().length > 0) {
      this.micSource = this.audio.createMediaStreamSource(stream);
      this.micSource.connect(this.micGain);
    }
  }

  setMicMuted(muted) { this.micGain.gain.value = muted ? 0 : 1; }

  // Music goes into the stream only (it isn't played out loud in the room)
  playMusic(url, { loop = true } = {}) {
    this.resumeAudio();
    this.musicEl.src = url;
    this.musicEl.loop = loop;
    return this.musicEl.play();
  }
  pauseMusic() { this.musicEl.pause(); }

  // Play a clip full screen; resolves when it ends (or is stopped)
  playClip(url) {
    this.resumeAudio();
    this.stopClip();
    this.clipEl.src = url;
    this.clipEl.currentTime = 0;
    this.clipPlaying = true;
    return new Promise((resolve, reject) => {
      const finish = () => { this.clipPlaying = false; this.clipEl.onended = null; resolve(); };
      this.clipEl.onended = finish;
      this.clipFinish = finish;
      this.clipEl.play().catch((error) => { this.clipPlaying = false; reject(error); });
    });
  }

  stopClip() {
    if (!this.clipPlaying) return;
    this.clipEl.pause();
    this.clipFinish?.();
  }

  // 0 to 1, for the progress bar
  clipProgress() {
    const d = this.clipEl.duration;
    return this.clipPlaying && d ? Math.min(1, this.clipEl.currentTime / d) : 0;
  }
  setMusicVolume(v) { this.musicGain.gain.value = v; }

  // Microphone loudness from 0 to 1, for the level meter
  micLevel() {
    this.micAnalyser.getByteTimeDomainData(this.levelBuffer);
    let peak = 0;
    for (const v of this.levelBuffer) peak = Math.max(peak, Math.abs(v - 128));
    return Math.min(1, peak / 100);
  }

  // ---------- Drawing ----------

  drawBackground() {
    const { ctx } = this;
    const bg = this.state.background;
    if (bg) {
      drawFit(ctx, bg, bg.naturalWidth, bg.naturalHeight, 0, 0, WIDTH, HEIGHT, 'cover');
    } else {
      const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      g.addColorStop(0, NAVY);
      g.addColorStop(1, NAVY_DEEP);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  // The outline of a box: a circle, or a rectangle with rounded corners
  boxPath(x, y, w, h, shape, radius) {
    const { ctx } = this;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      roundedRect(ctx, x, y, w, h, Math.max(0, Math.min(radius, Math.min(w, h) / 2)));
    }
  }

  drawVideoBox(video, x, y, w, h, fit, radius = 0, shape = 'rect') {
    const { ctx } = this;
    ctx.save();
    if (radius || shape === 'circle') {
      this.boxPath(x, y, w, h, shape, radius);
      ctx.clip();
    }
    if (hasFrame(video)) {
      // A picture fitted inside its box (a shared screen) gets a black frame filling the box,
      // so side-by-side boxes look the same size even when the picture's shape differs
      if (fit === 'contain' && (w < WIDTH || h < HEIGHT)) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, w, h);
      }
      drawFit(ctx, video, video.videoWidth, video.videoHeight, x, y, w, h, fit, video === this.cameraVideo && !!this.state.mirrorCamera);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, w, h);
      if (this.churchLogo && h > 60) {
        const s = Math.min(w, h) * 0.4;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(this.churchLogo, x + (w - s) / 2, y + (h - s) / 2, s, s);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  drawFramedVideo(video, x, y, w, h, fit, radius = 14, shape = 'rect') {
    const { ctx } = this;
    this.drawVideoBox(video, x, y, w, h, fit, radius, shape);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    this.boxPath(x, y, w, h, shape, radius);
    ctx.stroke();
  }

  // bottom: space taken by the ticker, so corner boxes sit above it
  drawLive(bottom = 0) {
    const cam = this.cameraVideo;
    const screen = this.screenVideo;
    const screenOn = hasFrame(screen);
    const layout = LAYOUTS.find((l) => l.id === this.state.layout)?.needsScreen && !screenOn ? 'camera' : this.state.layout;
    const pad = 24;
    this.slots = []; // where each source is drawn, for drag-to-swap on the preview

    // Two-box layouts have a main slot and a second slot. Normally the screen is in the main
    // slot (camera in the main slot for cameraPip); "swap" trades them.
    const cameraFirst = (layout === 'cameraPip') !== !!this.state.swap;
    const first = cameraFirst ? cam : screen;
    const second = cameraFirst ? screen : cam;
    const fitOf = (video) => (video === cam ? 'cover' : 'contain');
    // Box style (Style button): corner rounding for the camera box and the screen box
    // (set separately), and the camera box's shape
    const radiusOf = (value) => (Number.isFinite(Number(value)) ? Number(value) : 12);
    const cameraRadius = radiusOf(this.state.cameraRadius);
    const screenRadius = radiusOf(this.state.screenRadius);
    const place = (video, x, y, w, h, framed = false) => {
      if (video === cam && !hasFrame(cam) && framed) return; // no camera: leave the corner empty
      const full = w >= WIDTH && h >= HEIGHT;
      const shape = video === cam && !full ? (this.state.cameraShape || 'rect') : 'rect';
      if (shape === 'square' || shape === 'circle') {
        // A square (or circle) in the middle of the box
        const side = Math.min(w, h);
        x += (w - side) / 2;
        y += (h - side) / 2;
        w = side;
        h = side;
      }
      const radius = full ? 0 : video === cam ? cameraRadius : screenRadius;
      if (framed) this.drawFramedVideo(video, x, y, w, h, fitOf(video), radius, shape);
      else this.drawVideoBox(video, x, y, w, h, fitOf(video), radius, shape);
      this.slots.push({ source: video === cam ? 'camera' : 'screen', x, y, w, h });
    };

    if (layout === 'camera') {
      if (hasFrame(cam)) this.drawVideoBox(cam, 0, 0, WIDTH, HEIGHT, 'cover');
      else this.drawCenteredLogo(0.32);
    } else if (layout === 'screen') {
      this.drawVideoBox(screen, 0, 0, WIDTH, HEIGHT, 'contain');
    } else if (layout === 'pip' || layout === 'cameraPip') {
      // Full frame, plus a framed small box floating at the chosen spot (above the ticker)
      place(first, 0, 0, WIDTH, HEIGHT);
      const { side, align, size } = this.placementFor(layout);
      const w = Math.round(WIDTH * size);
      const h = Math.round(w * 9 / 16);
      const m = 32;
      const usableH = HEIGHT - bottom;
      const along = (start, length, box) => (align === 'start' ? start + m : align === 'end' ? start + length - box - m : start + (length - box) / 2);
      let x;
      let y;
      if (side === 'top' || side === 'bottom') {
        x = along(0, WIDTH, w);
        y = side === 'top' ? m : usableH - h - m;
      } else {
        x = side === 'left' ? m : WIDTH - w - m;
        y = along(0, usableH, h);
      }
      place(second, x, y, w, h, true);
    } else if (layout === 'side') {
      // The small box sits beside the big one; making it bigger makes the big one smaller
      const { side, align, size } = this.placementFor(layout);
      const sw = Math.round(WIDTH * size);
      const sh = Math.round(sw * 9 / 16);
      const along = (start, length, box) => (align === 'start' ? start : align === 'end' ? start + length - box : start + (length - box) / 2);
      if (side === 'left' || side === 'right') {
        const bigW = WIDTH - sw - pad * 3;
        const bigH = Math.min(HEIGHT - pad * 2, Math.round(bigW * 9 / 16));
        const bigX = side === 'right' ? pad : pad * 2 + sw;
        const bigY = (HEIGHT - bigH) / 2;
        place(first, bigX, bigY, bigW, bigH);
        place(second, side === 'right' ? pad * 2 + bigW : pad, along(bigY, bigH, sh), sw, sh);
      } else {
        const bigH = HEIGHT - sh - pad * 3;
        const bigW = Math.min(WIDTH - pad * 2, Math.round(bigH * 16 / 9));
        const bigX = (WIDTH - bigW) / 2;
        const bigY = side === 'bottom' ? pad : pad * 2 + sh;
        place(first, bigX, bigY, bigW, bigH);
        place(second, along(bigX, bigW, sw), side === 'bottom' ? pad * 2 + bigH : pad, sw, sh);
      }
    } else if (layout === 'splitTall') {
      // Two equal halves, full height
      const w = (WIDTH - pad * 3) / 2;
      const h = HEIGHT - bottom - pad * 2;
      place(first, pad, pad, w, h);
      place(second, pad * 2 + w, pad, w, h);
    } else if (layout === 'split') {
      const w = (WIDTH - pad * 3) / 2;
      const h = Math.round(w * 9 / 16);
      const y = (HEIGHT - h) / 2;
      place(first, pad, y, w, h);
      place(second, pad * 2 + w, y, w, h);
    }
  }

  // Where the small box goes in a layout: { side: top|right|bottom|left, align: start|center|end, size: 0.1-0.45 }
  placementFor(layout) {
    const defaults = {
      side: { pos: 'right-center', size: 30 },
      pip: { pos: 'bottom-end', size: 27 },
      cameraPip: { pos: 'bottom-end', size: 30 }
    };
    const chosen = { ...defaults[layout], ...((this.state.placement || {})[layout] || {}) };
    const [side, align] = String(chosen.pos).split('-');
    return {
      side: ['top', 'right', 'bottom', 'left'].includes(side) ? side : 'right',
      align: ['start', 'center', 'end'].includes(align) ? align : 'center',
      size: Math.min(45, Math.max(10, Number(chosen.size) || 30)) / 100
    };
  }

  // Which drawn box (camera or screen) is at this point of the frame (canvas pixels), if any.
  // The last box drawn is on top (e.g. the picture-in-picture corner).
  slotAt(x, y) {
    const hits = (this.slots || []).filter((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    return hits[hits.length - 1] || null;
  }

  drawCenteredLogo(size, yShift = 0) {
    const logo = this.state.logo || this.churchLogo;
    if (!logo) return;
    const { ctx } = this;
    const h = HEIGHT * size;
    const w = h * (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, (WIDTH - w) / 2, (HEIGHT - h) / 2 + yShift, w, h);
  }

  // textColor: the words; numberColor: the countdown's big numbers (defaults to textColor)
  drawCard(text, big, textColor = '#ffffff', numberColor = '') {
    const { ctx } = this;
    const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const hasBig = !!big;
    this.drawCenteredLogo(hasBig ? 0.22 : 0.3, -HEIGHT * (hasBig ? 0.2 : 0.1));
    ctx.textAlign = 'center';
    // A soft glow that contrasts with the text: dark behind light text, light behind dark text
    const glowFor = (color) => (isDark(color) ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)');
    ctx.fillStyle = numberColor || textColor;
    ctx.shadowColor = glowFor(numberColor || textColor);
    ctx.shadowBlur = 12;
    let y = HEIGHT * (hasBig ? 0.5 : 0.62);
    if (hasBig) {
      ctx.font = `700 150px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(big, WIDTH / 2, y + 40);
      y += 150;
    }
    ctx.fillStyle = textColor;
    ctx.shadowColor = glowFor(textColor);
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const size = fitFont(ctx, line, i === 0 ? 600 : 400, i === 0 ? 46 : 32, WIDTH - 160);
      ctx.fillText(line, WIDTH / 2, y);
      y += size * 1.45;
    });
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
  }

  drawLogoBug() {
    const logo = this.state.logo;
    if (!logo || this.state.scene.kind !== 'live') return;
    const h = 96;
    const w = Math.min(260, h * (logo.naturalWidth / logo.naturalHeight));
    drawFit(this.ctx, logo, logo.naturalWidth, logo.naturalHeight, 28, 24, w, h, 'contain');
  }

  drawLowerThird(bottom) {
    const lt = this.state.lowerThird;
    if (!lt?.title) return;
    const { ctx } = this;
    const title = lt.title.trim();
    const subtitle = (lt.subtitle || '').trim();
    const maxText = WIDTH - 240;
    const titleSize = fitFont(ctx, title, 700, 36, maxText);
    const titleW = ctx.measureText(title).width;
    let subSize = 0;
    let subW = 0;
    if (subtitle) {
      subSize = fitFont(ctx, subtitle, 400, 26, maxText);
      subW = ctx.measureText(subtitle).width;
    }
    const h = subtitle ? 104 : 72;
    const w = Math.max(titleW, subW) + 72;
    const x = 48;
    const y = bottom - h;
    ctx.fillStyle = 'rgba(11, 29, 68, 0.92)';
    roundedRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.fillRect(x, y + 14, 6, h - 28);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${titleSize}px ${FONT}`;
    ctx.fillText(title, x + 32, subtitle ? y + 36 : y + h / 2);
    if (subtitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = `400 ${subSize}px ${FONT}`;
      ctx.fillText(subtitle, x + 32, y + 74);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Returns the height used, so the lower third sits above it
  tickerHeight() { return this.state.ticker?.text ? 52 : 0; }

  drawTickerBar() {
    const t = this.state.ticker;
    if (!t?.text) return 0;
    const { ctx } = this;
    const h = this.tickerHeight();
    const y = HEIGHT - h;
    ctx.fillStyle = 'rgba(11, 29, 68, 0.92)';
    ctx.fillRect(0, y, WIDTH, h);
    ctx.fillStyle = RED;
    ctx.fillRect(0, y, WIDTH, 3);
    ctx.font = `500 26px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const text = `${t.text.trim()}     •     `;
    const textW = ctx.measureText(text).width;
    // Move a little each frame at the chosen speed (pixels per second), so changing the speed
    // doesn't make the text jump; a new message starts from the right edge
    const now = performance.now();
    if (this.tickerKey !== t.startedAt) {
      this.tickerKey = t.startedAt;
      this.tickerOffset = 0;
      this.tickerLast = now;
    }
    const speed = Number(this.state.tickerSpeed) || 110;
    this.tickerOffset = (this.tickerOffset + ((now - this.tickerLast) / 1000) * speed) % textW;
    this.tickerLast = now;
    const offset = this.tickerOffset;
    for (let x = WIDTH - offset - textW * Math.ceil(WIDTH / textW); x < WIDTH; x += textW) {
      if (x + textW > 0) ctx.fillText(text, x, y + h / 2 + 2);
    }
    ctx.textBaseline = 'alphabetic';
    return h;
  }

  // A viewer's chat message, above the lower third (or where it would be)
  drawChat(bottom) {
    const m = this.state.chatShown;
    if (!m?.text) return;
    const { ctx } = this;
    const x = 48;
    const maxW = 760;
    const label = m.platform === 'facebook' ? 'Facebook' : m.platform === 'youtube' ? 'YouTube' : '';
    ctx.textBaseline = 'alphabetic';
    // Wrap the message onto up to 3 lines
    ctx.font = `400 26px ${FONT}`;
    const words = String(m.text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW - 48 && line) { lines.push(line); line = w; } else line = test;
      if (lines.length === 3) break;
    }
    if (line && lines.length < 3) lines.push(line);
    if (lines.length === 3 && words.join(' ').length > lines.join(' ').length) lines[2] = `${lines[2].replace(/\s+\S*$/, '')}…`;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.font = `700 22px ${FONT}`;
    const nameW = ctx.measureText(m.author || '').width + (label ? ctx.measureText(label).width + 44 : 0);
    const w = Math.min(maxW, Math.max(textW, nameW) + 48);
    const h = 58 + lines.length * 34;
    const y = bottom - h;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    roundedRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.textAlign = 'left';
    let nx = x + 24;
    if (label) {
      ctx.font = `700 15px ${FONT}`;
      const lw = ctx.measureText(label).width + 16;
      ctx.fillStyle = m.platform === 'facebook' ? '#1877f2' : '#e00';
      roundedRect(ctx, nx, y + 18, lw, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, nx + 8, y + 35);
      nx += lw + 10;
    }
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = NAVY;
    ctx.fillText(m.author || '', nx, y + 38, x + w - nx - 16);
    ctx.font = `400 26px ${FONT}`;
    ctx.fillStyle = '#18202d';
    lines.forEach((l, i) => ctx.fillText(l, x + 24, y + 76 + i * 34));
  }

  drawQr() {
    const qr = this.state.qr;
    if (!qr?.image) return;
    const { ctx } = this;
    const size = 170;
    const pad = 14;
    const labelH = qr.label ? 40 : 0;
    const w = size + pad * 2;
    const h = size + pad * 2 + labelH;
    const x = WIDTH - w - 32;
    const y = 28;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr.image, x + pad, y + pad, size, size);
    ctx.imageSmoothingEnabled = true;
    if (qr.label) {
      ctx.fillStyle = NAVY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(ctx, qr.label, 600, 20, w - 16);
      ctx.fillText(qr.label, x + w / 2, y + size + pad + labelH / 2 + 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  draw() {
    const { ctx } = this;
    const { scene, overlay } = this.state;
    this.slots = [];

    // A playing clip takes over the whole picture
    if (this.clipPlaying) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      if (hasFrame(this.clipEl) || this.clipEl.readyState >= 2) {
        drawFit(ctx, this.clipEl, this.clipEl.videoWidth || WIDTH, this.clipEl.videoHeight || HEIGHT, 0, 0, WIDTH, HEIGHT, 'contain');
      }
      return;
    }

    this.drawBackground();

    if (scene.kind === 'countdown') {
      const left = (scene.endsAt || 0) - Date.now();
      this.drawCard(scene.text, left > 0 ? formatCountdown(left) : '0:00', scene.textColor || '#ffffff', scene.numberColor || '');
    } else if (scene.kind === 'card') {
      this.drawCard(scene.text, '', scene.textColor || '#ffffff');
    } else {
      this.drawLive(this.tickerHeight());
    }

    if (overlay) ctx.drawImage(overlay, 0, 0, WIDTH, HEIGHT);
    this.drawLogoBug();
    const tickerH = this.drawTickerBar();
    this.drawLowerThird(HEIGHT - tickerH - 32);
    this.drawChat(HEIGHT - tickerH - 32 - (this.state.lowerThird?.title ? (this.state.lowerThird.subtitle ? 104 : 72) + 16 : 0));
    this.drawQr();
  }

  destroy() {
    this.stopTicker();
    this.musicEl.pause();
    this.clipEl.pause();
    this.output.getTracks().forEach((t) => t.stop());
    this.audioOut.stream.getTracks().forEach((t) => t.stop());
    this.audio.close().catch(() => {});
    this.host.remove();
    this.canvas.remove();
  }
}
