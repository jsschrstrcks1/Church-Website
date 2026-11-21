// Live Studio (/admin/live): stream to YouTube, Facebook, and more at the same time, with
// scenes (countdown, title cards, live), layouts, graphics, lower thirds, ticker, QR codes,
// and music. No subscription: the video goes out through the free Church Stream Helper running
// on the streaming computer (public/stream-helper; utils/streamHelper.js).
//
// Each computer that opens the studio is either:
//   - the streaming computer: camera, microphone, screen share and music are here, and it
//     sends the stream (through the helper on the same computer), or
//   - a co-host: switches scenes, layouts, graphics, captions and QR codes from another
//     computer, and sees a preview picture of what's on air.
// What's on screen is shared through liveStudio/control, so either can change it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiLiveStatus } from '../../api/client';
import { useMemberAuth } from '../../context/MemberAuthContext';
import { StudioMixer, LAYOUTS, WIDTH, HEIGHT, loadImage } from '../../utils/liveMixer';
import { endLiveStatus, goLiveStatus, loadClip, newId, postMonitor, useDestinations, useStudioControl, useStudioLibrary, useStudioMonitor } from '../../utils/liveStudioLibrary';
import { HelperStream, INSTALL_COMMAND, getHelperStatus } from '../../utils/streamHelper';
import {
  CaptionsPanel, ChatPanel, DestinationsPanel, Field, GraphicsPanel, Icon, ICONS, Modal, MusicPanel, QrPanel,
  darkInput, qrDataUrl
} from '../live/StudioPanels';

const ROLE_KEY = 'studioRole';
const MONITOR_EVERY_MS = 4000;
const MONITOR_FRESH_MS = 15000;
const HELPER_VERSION = '1.2.0'; // the version in public/stream-helper/helper.mjs

const olderThan = (a, b) => {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  return false;
};

const readRole = () => {
  try { return localStorage.getItem(ROLE_KEY) === 'cohost' ? 'cohost' : 'stream'; } catch { return 'stream'; }
};

const errorText = (error) => error?.message?.replace(/^.*?: /, '') || 'Something went wrong.';

const formatElapsed = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

const PANELS = [
  { id: 'channels', label: 'Channels', icon: ICONS.broadcast },
  { id: 'graphics', label: 'Graphics', icon: ICONS.graphics },
  { id: 'captions', label: 'Captions', icon: ICONS.captions },
  { id: 'chat', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'qr', label: 'QR codes', icon: ICONS.qr },
  { id: 'music', label: 'Music', icon: ICONS.music }
];

const SCENE_KINDS = {
  live: 'Live (camera and screen)',
  countdown: 'Countdown',
  card: 'Title card'
};

// ---------- Scene editor ----------

const TEXT_COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#10295e', label: 'Navy' },
  { value: '#18202d', label: 'Black' },
  { value: '#e6252e', label: 'Red' },
  { value: '#e7bd49', label: 'Gold' }
];

// Swatches plus a custom color; '' (for the countdown numbers) means "same as the text"
const ColorChoice = ({ label, value, onChange, allowSame }) => (
  <div>
    <span className="block text-sm font-medium text-white/80 mb-1">{label}</span>
    <div className="flex flex-wrap items-center gap-2">
      {allowSame && (
        <button type="button" onClick={() => onChange('')}
          className={`px-2 h-8 rounded-full text-xs border ${!value ? 'border-church-blue ring-2 ring-church-blue' : 'border-white/20'}`}>Same as text</button>
      )}
      {TEXT_COLORS.map((c) => (
        <button key={c.value} type="button" onClick={() => onChange(c.value)} title={c.label} aria-label={c.label}
          className={`w-8 h-8 rounded-full border-2 ${value?.toLowerCase() === c.value ? 'border-church-blue ring-2 ring-church-blue' : 'border-white/30'}`}
          style={{ background: c.value }} />
      ))}
      <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer">
        <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
        Custom
      </label>
    </div>
  </div>
);

const SceneForm = ({ scene, backgrounds, onSave, onDelete, onClose }) => {
  const [draft, setDraft] = useState({ name: '', kind: 'card', text: '', minutes: 5, backgroundId: '', thenLive: true, textColor: '#ffffff', numberColor: '', ...scene });
  const [error, setError] = useState('');
  const set = (changes) => setDraft((d) => ({ ...d, ...changes }));
  return (
    <Modal title={scene.id ? 'Edit scene' : 'Add a scene'} onClose={onClose} error={error}
      onSubmit={() => {
        if (!draft.name.trim()) { setError('Give the scene a name.'); return; }
        const minutes = Math.min(180, Math.max(0.25, Number(draft.minutes) || 5));
        onSave({ ...draft, id: draft.id || newId(), name: draft.name.trim().slice(0, 40), text: (draft.text || '').slice(0, 300), minutes });
      }}>
      <Field label="Name"><input autoFocus type="text" maxLength={40} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Before service" className={darkInput} /></Field>
      <Field label="Type">
        <select value={draft.kind} onChange={(e) => set({ kind: e.target.value })} className={darkInput}>
          {Object.entries(SCENE_KINDS).map(([id, label]) => <option key={id} value={id} className="text-black">{label}</option>)}
        </select>
      </Field>
      {draft.kind !== 'live' && (
        <Field label="Text" hint="The first line is large. Press Enter for more lines.">
          <textarea rows={3} maxLength={300} value={draft.text} onChange={(e) => set({ text: e.target.value })} className={darkInput} />
        </Field>
      )}
      {draft.kind !== 'live' && (
        <ColorChoice label="Text color" value={draft.textColor || '#ffffff'} onChange={(v) => set({ textColor: v || '#ffffff' })} />
      )}
      {draft.kind === 'countdown' && (
        <ColorChoice label="Countdown numbers color" value={draft.numberColor || ''} onChange={(v) => set({ numberColor: v })} allowSame />
      )}
      {draft.kind === 'countdown' && (
        <>
          <Field label="Minutes"><input type="number" min="0.25" max="180" step="0.25" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} className={darkInput} /></Field>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={draft.thenLive !== false} onChange={(e) => set({ thenLive: e.target.checked })} className="w-4 h-4 accent-church-blue" />
            Switch to the Live scene when it reaches zero
          </label>
        </>
      )}
      <Field label="Background" hint="Upload backgrounds under Graphics.">
        <select value={draft.backgroundId || ''} onChange={(e) => set({ backgroundId: e.target.value })} className={darkInput}>
          <option value="" className="text-black">The studio's background</option>
          {backgrounds.map((b) => <option key={b.id} value={b.id} className="text-black">{b.name}</option>)}
        </select>
      </Field>
      {scene.id && (
        <button type="button" onClick={onDelete} className="text-sm text-red-300 hover:underline">Delete this scene</button>
      )}
    </Modal>
  );
};

// ---------- Device settings ----------

const SettingsModal = ({ devices, cameraId, micId, onCamera, onMic, mirror, onMirror, onClose }) => (
  <Modal title="Camera and microphone" onClose={onClose} onSubmit={onClose} submitLabel="Done">
    <Field label="Camera">
      <select value={cameraId} onChange={(e) => onCamera(e.target.value)} className={darkInput}>
        <option value="" className="text-black">Default camera</option>
        {devices.cameras.map((d, i) => <option key={d.deviceId || i} value={d.deviceId} className="text-black">{d.label || `Camera ${i + 1}`}</option>)}
      </select>
    </Field>
    <Field label="Microphone" hint="For a sound board, choose its USB audio input. Echo cancellation and noise reduction are off so music sounds natural.">
      <select value={micId} onChange={(e) => onMic(e.target.value)} className={darkInput}>
        <option value="" className="text-black">Default microphone</option>
        {devices.mics.map((d, i) => <option key={d.deviceId || i} value={d.deviceId} className="text-black">{d.label || `Microphone ${i + 1}`}</option>)}
      </select>
    </Field>
    <label className="flex items-start gap-3 text-sm text-white/80">
      <input type="checkbox" checked={mirror} onChange={(e) => onMirror(e.target.checked)} className="mt-0.5 w-4 h-4 accent-church-blue" />
      <span>
        <span className="block font-medium">Mirror camera</span>
        <span className="block text-xs text-white/50">Flip the camera left-to-right, on the stream too. Leave it off if there's writing (signs, shirts, a whiteboard) in view, or it will read backwards.</span>
      </span>
    </label>
  </Modal>
);

// ---------- Stream helper setup ----------

const HelperSetupModal = ({ onClose, onCheck }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Modal title="Set up this computer to stream" onClose={onClose} onSubmit={() => { onCheck(); onClose(); }} submitLabel="Check again">
      <p className="text-sm text-white/80">
        The streaming computer needs the free <strong>Church Stream Helper</strong>. It sends the stream to YouTube, Facebook and your other channels. You only have to do this once per computer (Mac).
      </p>
      <ol className="text-sm text-white/80 space-y-3 list-decimal pl-5">
        <li>Open <strong>Terminal</strong> (press ⌘ Space, type <em>Terminal</em>, press Return).</li>
        <li>
          Paste this line and press Return:
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 min-w-0 block px-3 py-2 rounded-lg bg-black/40 text-xs font-mono break-all">{INSTALL_COMMAND}</code>
            <button type="button" onClick={copy} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium flex-shrink-0">{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </li>
        <li>Wait for "The Church Stream Helper is running." It starts by itself whenever this Mac starts.</li>
        <li>Back here, if Chrome asks to allow access to <em>apps and services on this device</em> or your <em>local network</em>, click <strong>Allow</strong>.</li>
      </ol>
      <p className="text-xs text-white/50">Use Google Chrome for the studio. To remove the helper later, run the same line with <code>-s -- --uninstall</code> added after <code>bash</code>.</p>
    </Modal>
  );
};

// ---------- Box style (shape and corner rounding), like Restream's Customization ----------

const SHAPES = [
  { id: 'rect', label: 'Rectangle', icon: <span className="block w-7 h-4 rounded-sm border-2 border-current" /> },
  { id: 'square', label: 'Square', icon: <span className="block w-5 h-5 rounded-sm border-2 border-current" /> },
  { id: 'circle', label: 'Circle', icon: <span className="block w-5 h-5 rounded-full border-2 border-current" /> }
];

// The 12 spots for the small box, laid out like Restream's grid (5 x 5, edges only)
const POSITION_CELLS = [
  [0, 1, 'top-start'], [0, 2, 'top-center'], [0, 3, 'top-end'],
  [1, 0, 'left-start'], [2, 0, 'left-center'], [3, 0, 'left-end'],
  [1, 4, 'right-start'], [2, 4, 'right-center'], [3, 4, 'right-end'],
  [4, 1, 'bottom-start'], [4, 2, 'bottom-center'], [4, 3, 'bottom-end']
];
const PLACEMENT_DEFAULTS = { side: { pos: 'right-center', size: 30 }, pip: { pos: 'bottom-end', size: 27 }, cameraPip: { pos: 'bottom-end', size: 30 } };

const PlacementControls = ({ layout, placement, onChange }) => {
  const current = { ...PLACEMENT_DEFAULTS[layout], ...((placement || {})[layout] || {}) };
  const set = (changes) => onChange({ placement: { ...(placement || {}), [layout]: { ...current, ...changes } } });
  return (
    <div className="space-y-3">
      <div>
        <span className="block text-sm font-medium text-white/80 mb-1">Small box position</span>
        <p className="text-xs text-white/50 mb-2">{layout === 'side' ? 'Beside the big box: the big box moves over to make room.' : 'Floating over the big picture.'}</p>
        <div className="grid grid-cols-5 grid-rows-5 gap-1 w-56 h-36 mx-auto rounded-lg bg-white/5 p-1.5">
          {POSITION_CELLS.map(([row, col, pos]) => (
            <button key={pos} type="button" onClick={() => set({ pos })} aria-label={pos.replace('-', ' ')} aria-pressed={current.pos === pos}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              className={`rounded ${current.pos === pos ? 'bg-church-blue' : 'bg-white/10 hover:bg-white/20'}`} />
          ))}
          <span className="row-start-2 row-span-3 col-start-2 col-span-3 rounded bg-white/15 flex items-center justify-center text-[10px] text-white/50">big box</span>
        </div>
      </div>
      <label className="block">
        <span className="flex justify-between text-sm font-medium text-white/80 mb-1"><span>Small box size</span><span className="text-white/50">{current.size}%</span></span>
        <input type="range" min="10" max="45" step="1" value={current.size} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full accent-church-blue" />
      </label>
    </div>
  );
};

const StyleModal = ({ shape, cameraRadius, screenRadius, layout, placement, onChange, onClose }) => {
  // Off by default: the camera and screen corners are set separately unless this is ticked
  const [linked, setLinked] = useState(false);
  const setRadius = (which, value) => onChange(linked ? { cameraRadius: value, screenRadius: value } : { [which]: value });
  const slider = (label, which, value) => (
    <label className="block">
      <span className="flex justify-between text-sm font-medium text-white/80 mb-1"><span>{label}</span><span className="text-white/50">{value}px</span></span>
      <input type="range" min="0" max="60" step="2" value={value} onChange={(e) => setRadius(which, Number(e.target.value))} className="w-full accent-church-blue" />
    </label>
  );
  return (
    <Modal title="Box style" onClose={onClose} onSubmit={onClose} submitLabel="Done">
      {PLACEMENT_DEFAULTS[layout]
        ? <PlacementControls layout={layout} placement={placement} onChange={onChange} />
        : <p className="text-xs text-white/50">Choose the "Screen large, camera beside" or a corner layout to move and resize the small box.</p>}
      <div>
        <span className="block text-sm font-medium text-white/80 mb-2">Camera shape</span>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((sh) => (
            <button key={sh.id} type="button" onClick={() => onChange({ cameraShape: sh.id })} aria-pressed={shape === sh.id}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs ${shape === sh.id ? 'bg-church-blue/25 ring-2 ring-church-blue' : 'bg-white/5 hover:bg-white/10'}`}>
              {sh.icon}{sh.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50 mt-1">For the camera box in two-box layouts. A full-screen camera stays full screen.</p>
      </div>
      {slider('Camera corners', 'cameraRadius', cameraRadius)}
      {slider('Screen corners', 'screenRadius', screenRadius)}
      <label className="flex items-center gap-2 text-sm text-white/80">
        <input type="checkbox" checked={linked} onChange={(e) => {
          setLinked(e.target.checked);
          if (e.target.checked) onChange({ screenRadius: cameraRadius });
        }} className="w-4 h-4 accent-church-blue" />
        Same for both
      </label>
      <button type="button" onClick={() => { setLinked(false); onChange({ cameraShape: 'rect', cameraRadius: 12, screenRadius: 12, placement: {} }); }}
        className="text-sm text-white/60 underline hover:text-white">Reset</button>
    </Modal>
  );
};

// Layouts with a camera box and a screen box that can trade places
const TWO_BOX = ['pip', 'cameraPip', 'side', 'split', 'splitTall'];

const LayoutIcon = ({ boxes }) => (
  <span className="relative block w-14 h-8">
    {boxes.map(([x, y, w, h], i) => (
      <span key={i} className={`absolute rounded-sm ${i === 0 ? 'bg-white/35' : 'bg-white/60 ring-1 ring-[#2a2a2f]'}`}
        style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} />
    ))}
  </span>
);

// ---------- The studio ----------

const LiveStudio = () => {
  const navigate = useNavigate();
  const { memberProfile } = useMemberAuth();
  const uid = memberProfile?.uid || memberProfile?.id || '';
  const previewRef = useRef(null);
  const meterRef = useRef(null);
  const outRef = useRef(null); // the HelperStream while this computer is sending
  const streamsRef = useRef({ camera: null, mic: null, screen: null });
  const tickerStartRef = useRef({ id: null, startedAt: 0 });
  const sendStartedAtRef = useRef(0); // when this computer started sending
  const [mixer, setMixer] = useState(null);

  const [role, setRoleState] = useState(readRole);
  const streamer = role === 'stream';
  const setRole = (r) => {
    if (outRef.current) return; // can't switch while this computer is sending
    setRoleState(r);
    try { localStorage.setItem(ROLE_KEY, r); } catch { /* remembered for this visit only */ }
  };

  const { library, assets, saveList } = useStudioLibrary();
  const { destinations, removeDestination: removeStoredDestination } = useDestinations();
  const [selected, setSelected] = useState(() => new Set());
  const { control, updateControl } = useStudioControl(uid);
  const [searchParams, setSearchParams] = useSearchParams();

  // Automatic setup (YouTube, Facebook): whether each is switched on (functions .env) and connected
  const [autoInfo, setAutoInfo] = useState(null);
  const [youtubeLink, setYoutubeLink] = useState(null);
  const [facebookLink, setFacebookLink] = useState(null);
  const [connectBusy, setConnectBusy] = useState('');
  const monitor = useStudioMonitor(!streamer);

  // Sources (streaming computer only)
  const [devices, setDevices] = useState({ cameras: [], mics: [] });
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  // Flip the camera left-to-right (remembered on this computer)
  const [mirrorCamera, setMirrorCamera] = useState(() => { try { return localStorage.getItem('studioMirror') === '1'; } catch { return false; } });
  const changeMirror = (on) => {
    setMirrorCamera(on);
    try { localStorage.setItem('studioMirror', on ? '1' : '0'); } catch { /* this visit only */ }
  };
  const [sharing, setSharing] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const [editingScene, setEditingScene] = useState(null);
  const [drag, setDrag] = useState(null); // dragging a box on the preview: { from, over } (canvas boxes)
  const [showStyle, setShowStyle] = useState(false);
  const [panel, setPanel] = useState('channels');

  // Channels, helper, and broadcast
  const [helper, setHelper] = useState(undefined); // undefined = checking, null = not found
  const [showHelperSetup, setShowHelperSetup] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | starting | live | stopping
  const [sendingHere, setSendingHere] = useState(false);
  const [broadcast, setBroadcast] = useState(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());

  const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const scenes = useMemo(() => library?.scenes || [], [library]);
  const liveScene = useMemo(() => scenes.find((s) => s.kind === 'live') || { id: 'live', kind: 'live', name: 'Live' }, [scenes]);
  const scene = scenes.find((s) => s.id === control.sceneId) || liveScene;
  const monitorFresh = !streamer && monitor && Date.now() - Date.parse(monitor.updatedAt || 0) < MONITOR_FRESH_MS;
  const screenAvailable = streamer ? sharing : !!monitor?.sharing;

  // ----- Mixer -----
  useEffect(() => {
    const m = new StudioMixer();
    m.canvas.className = 'w-full h-full block';
    previewRef.current?.appendChild(m.canvas);
    setMixer(m);

    let frame;
    const meter = () => {
      if (meterRef.current) meterRef.current.style.height = `${Math.round(m.micLevel() * 100)}%`;
      frame = requestAnimationFrame(meter);
    };
    frame = requestAnimationFrame(meter);

    const streams = streamsRef.current;
    return () => {
      cancelAnimationFrame(frame);
      if (outRef.current) {
        outRef.current.stop();
        outRef.current = null;
        endLiveStatus();
      }
      Object.values(streams).forEach((s) => s?.getTracks().forEach((t) => t.stop()));
      m.destroy();
    };
  }, []);

  // Uploaded pictures, decoded once
  const [images, setImages] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all((assets || []).map(async (a) => [a.id, await loadImage(a.dataUrl)])).then((pairs) => {
      if (!cancelled) setImages(Object.fromEntries(pairs.filter(([, img]) => img)));
    });
    return () => { cancelled = true; };
  }, [assets]);

  const [qrImage, setQrImage] = useState(null);
  const qrUrl = control.qr?.url || '';
  useEffect(() => {
    let cancelled = false;
    if (!qrUrl) { setQrImage(null); return undefined; }
    qrDataUrl(qrUrl).then(loadImage).then((img) => { if (!cancelled) setQrImage(img); });
    return () => { cancelled = true; };
  }, [qrUrl]);

  // Tell the mixer what to draw
  useEffect(() => {
    if (!mixer) return;
    const tickerId = control.ticker?.id || null;
    if (tickerStartRef.current.id !== tickerId) tickerStartRef.current = { id: tickerId, startedAt: performance.now() };
    mixer.set({
      scene: { kind: scene.kind, text: scene.text || '', endsAt: control.sceneEndsAt || 0, textColor: scene.textColor || '', numberColor: scene.numberColor || '' },
      layout: control.layout,
      swap: !!control.swap,
      mirrorCamera,
      tickerSpeed: control.tickerSpeed || 110,
      chatShown: control.chatShown || null,
      cameraRadius: control.cameraRadius ?? 12,
      screenRadius: control.screenRadius ?? 12,
      cameraShape: control.cameraShape || 'rect',
      placement: control.placement || {},
      background: images[scene.backgroundId] || images[control.background] || null,
      logo: images[control.logo] || null,
      overlay: images[control.overlay] || null,
      lowerThird: control.lowerThird,
      ticker: control.ticker ? { ...control.ticker, startedAt: tickerStartRef.current.startedAt } : null,
      qr: control.qr && qrImage ? { image: qrImage, label: control.qr.label } : null
    });
  }, [mixer, scene, control, images, qrImage, mirrorCamera]);

  // ----- Video clips: control.clip = { id, startedAt } while one plays (set from any computer);
  // the streaming computer downloads it once and plays it full screen, then clears it -----
  const [clipState, setClipState] = useState(null); // { id, status: 'loading' | 'playing' } here
  const clipId = control.clip?.id || '';
  const clipStartedAt = control.clip?.startedAt || 0;
  useEffect(() => {
    if (!streamer || !mixer) return undefined;
    if (!clipId) { mixer.stopClip(); setClipState(null); return undefined; }
    let cancelled = false;
    setClipState({ id: clipId, status: 'loading' });
    loadClip(clipId)
      .then((url) => {
        if (cancelled) return undefined;
        setClipState({ id: clipId, status: 'playing' });
        return mixer.playClip(url).then(() => {
          if (!cancelled) { setClipState(null); updateControl({ clip: null }); }
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Clip failed:', error);
        setNotice(`The video clip couldn't play: ${error.message || error}`);
        setClipState(null);
        updateControl({ clip: null });
      });
    return () => { cancelled = true; };
  }, [streamer, mixer, clipId, clipStartedAt, updateControl]);

  // Download every clip ahead of time on the streaming computer, so clicking one plays at once
  useEffect(() => {
    if (!streamer) return;
    (assets || []).filter((a) => a.kind === 'video').forEach((a) => { loadClip(a.id).catch(() => {}); });
  }, [streamer, assets]);

  const toggleClip = (asset) => {
    mixer?.resumeAudio();
    updateControl({ clip: control.clip?.id === asset.id ? null : { id: asset.id, startedAt: Date.now() } });
  };
  const clipForPanel = streamer
    ? (clipState || (control.clip ? { id: control.clip.id, status: 'loading' } : null))
    : (control.clip ? { id: control.clip.id, status: 'playing' } : null);

  const switchScene = useCallback((s) => {
    mixer?.resumeAudio();
    updateControl({ sceneId: s.id, sceneEndsAt: s.kind === 'countdown' ? Date.now() + (Number(s.minutes) || 5) * 60000 : 0 });
  }, [mixer, updateControl]);

  // Countdown finished: go to the Live scene if the scene says so
  useEffect(() => {
    if (scene.kind !== 'countdown' || scene.thenLive === false || !control.sceneEndsAt) return undefined;
    const id = setTimeout(() => switchScene(liveScene), Math.max(0, control.sceneEndsAt - Date.now()) + 1000);
    return () => clearTimeout(id);
  }, [scene, control.sceneEndsAt, liveScene, switchScene]);

  // ----- Sources (streaming computer only) -----
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({ cameras: list.filter((d) => d.kind === 'videoinput'), mics: list.filter((d) => d.kind === 'audioinput') });
    } catch {
      // Device names are a nicety; the default devices still work
    }
  }, []);

  useEffect(() => {
    if (!mixer) return undefined;
    let cancelled = false;
    streamsRef.current.camera?.getTracks().forEach((t) => t.stop());
    streamsRef.current.camera = null;
    mixer.setCamera(null);
    if (!streamer || !cameraOn) return undefined;
    navigator.mediaDevices.getUserMedia({
      video: { deviceId: cameraId ? { exact: cameraId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamsRef.current.camera = stream;
      mixer.setCamera(stream);
      setMediaError('');
      refreshDevices();
    }).catch((error) => {
      console.error('Camera error:', error);
      if (!cancelled) setMediaError('The camera could not start. Allow camera access in the browser, or choose another camera in Settings.');
    });
    return () => { cancelled = true; };
  }, [mixer, streamer, cameraOn, cameraId, refreshDevices]);

  // Echo cancellation and noise suppression are off: nothing plays back in the studio, and
  // those filters make singing and music sound thin.
  useEffect(() => {
    if (!mixer) return undefined;
    let cancelled = false;
    streamsRef.current.mic?.getTracks().forEach((t) => t.stop());
    streamsRef.current.mic = null;
    mixer.setMic(null);
    if (!streamer) return undefined;
    navigator.mediaDevices.getUserMedia({
      audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } }
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamsRef.current.mic = stream;
      mixer.setMic(stream);
      refreshDevices();
    }).catch((error) => {
      console.error('Microphone error:', error);
      if (!cancelled) setMediaError('The microphone could not start. Allow microphone access in the browser, or choose another one in Settings.');
    });
    return () => { cancelled = true; };
  }, [mixer, streamer, micId, refreshDevices]);

  useEffect(() => { mixer?.setMicMuted(micMuted); }, [mixer, micMuted]);

  const stopSharing = useCallback(() => {
    streamsRef.current.screen?.getTracks().forEach((t) => t.stop());
    streamsRef.current.screen = null;
    mixer?.setScreen(null);
    setSharing(false);
  }, [mixer]);

  // A co-host can't share this computer's screen into the stream
  useEffect(() => { if (!streamer) stopSharing(); }, [streamer, stopSharing]);

  const startSharing = async () => {
    mixer?.resumeAudio();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true // lets the person include tab or system audio (a video, music) if they tick the box
      });
      streamsRef.current.screen = stream;
      mixer?.setScreen(stream);
      stream.getVideoTracks()[0].addEventListener('ended', stopSharing); // the browser's own "Stop sharing"
      setSharing(true);
      updateControl({ layout: cameraOn ? 'pip' : 'screen', sceneId: liveScene.id, sceneEndsAt: 0 });
    } catch (error) {
      if (error?.name !== 'NotAllowedError') {
        console.error('Screen share error:', error);
        setMediaError('Screen sharing could not start.');
      }
    }
  };

  // One-tap for the volunteer: capture the Proclaim window (lyrics/announcements) and,
  // if the camera is on, show it as the small box in the corner over the camera. The
  // browser will ask which window to share — they just tap "Faithlife Proclaim".
  const captureProclaim = async () => {
    mixer?.resumeAudio();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true
      });
      streamsRef.current.screen = stream;
      mixer?.setScreen(stream);
      stream.getVideoTracks()[0].addEventListener('ended', stopSharing);
      setSharing(true);
      // layout 'pip' + swap => camera full-screen, the screen source (Proclaim) in the corner.
      updateControl({
        layout: cameraOn ? 'pip' : 'screen',
        swap: cameraOn,
        sceneId: liveScene.id,
        sceneEndsAt: 0
      });
    } catch (error) {
      if (error?.name !== 'NotAllowedError') {
        console.error('Proclaim capture error:', error);
        setMediaError('Could not capture Proclaim. In the window that opens, choose "Faithlife Proclaim" and tap Share.');
      }
    }
  };

  // ----- Stream helper (streaming computer only) -----
  const checkHelper = useCallback(async () => {
    const status = await getHelperStatus();
    setHelper(status && { ...status, checkedAt: Date.now() });
    return status;
  }, []);

  useEffect(() => {
    if (!streamer) return undefined;
    checkHelper();
    const id = setInterval(checkHelper, sendingHere ? 4000 : 10000);
    return () => clearInterval(id);
  }, [streamer, sendingHere, checkHelper]);

  // ----- Preview picture for co-hosts (posted by the streaming computer) -----
  useEffect(() => {
    if (!streamer || !mixer) return undefined;
    const small = document.createElement('canvas');
    small.width = 480;
    small.height = 270;
    const post = () => {
      small.getContext('2d').drawImage(mixer.canvas, 0, 0, small.width, small.height);
      postMonitor({
        image: small.toDataURL('image/jpeg', 0.6),
        sharing,
        cameraOn,
        micMuted,
        live: !!outRef.current,
        helper: helper ? { ok: !!helper.ok, outputs: helper.outputs || [] } : null,
        updatedBy: uid
      });
    };
    post();
    const id = setInterval(post, MONITOR_EVERY_MS);
    return () => clearInterval(id);
  }, [streamer, mixer, sharing, cameraOn, micMuted, helper, uid]);

  // ----- Automatic setup (YouTube, Facebook) -----
  useEffect(() => {
    // SELF-HOSTED: there is no Firebase Functions backend to auto-create YouTube/Facebook
    // broadcasts. Automatic setup (OAuth connect, choose-page, automatic GO LIVE) is not
    // available; publishing is manual through each channel's RTMP key.
    setAutoInfo({ configured: false, facebookConfigured: false });
    setYoutubeLink({ connected: false });
    setFacebookLink({ connected: false });
    console.warn('self-hosted: automatic YouTube/Facebook setup is unavailable — publish with a manual RTMP key.');
  }, []);

  // Back from Google's or Facebook's sign-in page (?youtube=connected, ?facebook=choose, ...=error&message=...)
  useEffect(() => {
    const platform = searchParams.get('youtube') ? 'youtube' : searchParams.get('facebook') ? 'facebook' : '';
    if (!platform) return;
    const result = searchParams.get(platform);
    setPanel('channels');
    setNotice(result === 'error' ? (searchParams.get('message') || 'Connecting failed.') : '');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const connectPlatform = async (platform) => {
    setConnectBusy(platform);
    // SELF-HOSTED: no OAuth connect backend. Publishing is manual via each channel's RTMP key.
    console.warn(`self-hosted: automatic ${platform} connect is unavailable — publish with a manual RTMP key.`);
    setNotice(`Automatic ${platform} setup is unavailable in self-hosted mode. Add the channel under Stream to with its RTMP stream key instead.`);
    setConnectBusy('');
  };

  const disconnectPlatform = async (platform) => {
    const name = platform === 'facebook' ? 'Facebook Page' : 'YouTube channel';
    if (!window.confirm(`Disconnect the ${name}? GO LIVE will then use the saved stream key again, and each broadcast will need preparing on ${platform === 'facebook' ? 'Facebook' : 'YouTube'} by hand.`)) return;
    console.warn(`self-hosted: automatic ${name} disconnect is a no-op (no OAuth backend).`);
  };

  const choosePage = (pageId) => {
    console.warn('self-hosted: Facebook choose-page is unavailable (no OAuth backend).');
    return Promise.resolve();
  };

  const auto = autoInfo ? {
    ...autoInfo,
    channelTitle: youtubeLink?.channelTitle,
    connected: !!autoInfo.configured && !!youtubeLink?.connected,
    pageName: facebookLink?.pageName,
    choosePages: facebookLink?.choosePages,
    facebookConnected: !!autoInfo.facebookConfigured && !!facebookLink?.connected
  } : null;

  // ----- Live chat (YouTube + Facebook) -----
  // SELF-HOSTED: no chat relay backend; the chat list is empty and commands warn.
  const [chatMessages, setChatMessages] = useState([]);
  const [chatErrors, setChatErrors] = useState({});
  useEffect(() => {
    setChatMessages([]);
    console.warn('self-hosted: live chat requires a backend relay and is unavailable.');
  }, []);

  // Only the streaming computer asks YouTube and Facebook for new messages (saves YouTube's daily allowance)
  useEffect(() => {
    if (!sendingHere) return undefined;
    console.warn('self-hosted: chat polling requires a backend relay and is unavailable.');
    return undefined;
  }, [sendingHere]);

  const showChat = (m) => updateControl({
    chatShown: control.chatShown?.id === m.id ? null : { id: m.id, author: m.author, text: m.text, platform: m.platform }
  });
  const sendChat = async (text, platforms) => {
    console.warn('self-hosted: sending chat requires a backend relay and is unavailable.');
    return { errors: {} };
  };

  // ----- Channels -----
  // SELF-HOSTED: destinations come from the in-memory store (useDestinations), synced to the
  // API via apiSaveDestinations. Everything starts ticked, and new channels are ticked as added.
  const knownDestinations = useRef(new Set());
  useEffect(() => {
    const list = destinations || [];
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => list.some((d) => d.id === id)));
      list.forEach((d) => { if (!knownDestinations.current.has(d.id)) { knownDestinations.current.add(d.id); next.add(d.id); } });
      return next;
    });
  }, [destinations]);

  const toggleSelected = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const removeDestination = async (d) => {
    if (!window.confirm(`Remove "${d.name}"? Its stream key will be deleted too.`)) return;
    try {
      await removeStoredDestination(d.id);
    } catch (error) {
      console.error('Error removing channel:', error);
      setNotice('Could not remove that channel.');
    }
  };

  // ----- Broadcast -----
  const endHere = useCallback((message) => {
    const out = outRef.current;
    outRef.current = null;
    setSendingHere(false);
    out?.stop();
    if (message) setNotice(message);
  }, []);

  // What's on air. Also catches a stream ended from another computer (a co-host's End stream).
  const refreshStatus = useCallback(async () => {
    try {
      const data = await apiLiveStatus();
      const live = !!data?.live;
      if (live) {
        setBroadcast((b) => b || { status: 'live', startedAt: new Date().toISOString() });
      } else {
        setBroadcast(null);
        if (outRef.current) endHere('The stream ended.');
      }
      setPhase((p) => (p === 'starting' || p === 'stopping' ? p : live ? 'live' : 'idle'));
    } catch (error) {
      console.error('Status check failed:', error);
    }
  }, [endHere]);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, phase === 'live' ? 8000 : 20000);
    return () => clearInterval(id);
  }, [refreshStatus, phase]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The streaming computer checks in every 30 seconds; without it, the stream counts as ended
  useEffect(() => {
    if (!sendingHere) return undefined;
    console.warn('self-hosted: live heartbeat is handled locally (no backend session) — keep this browser tab open while live.');
    return undefined;
  }, [sendingHere]);

  // The helper's ffmpeg stopped on its own (internet dropped, all channels refused).
  // Only a status checked after this stream started counts: an older one says "not live".
  useEffect(() => {
    if (sendingHere && helper && !helper.live && helper.checkedAt > sendStartedAtRef.current) {
      endHere(helper.lastError || 'The stream stopped.');
      endLiveStatus();
      setBroadcast(null);
      setPhase('idle');
    }
  }, [sendingHere, helper, endHere]);

  // Warn before closing the tab while sending (closing it ends the stream)
  useEffect(() => {
    if (!sendingHere) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sendingHere]);

  const goLive = async () => {
    if (!mixer || !streamer) return;
    const ids = (destinations || []).filter((d) => selected.has(d.id)).map((d) => d.id);
    if (ids.length === 0) {
      setPanel('channels');
      setNotice('Tick at least one channel to stream to.');
      return;
    }
    mixer.resumeAudio();
    setNotice('');
    const status = await checkHelper();
    if (!status) { setShowHelperSetup(true); return; }
    if (!status.ok) { setNotice('The stream helper is running but ffmpeg is missing. Run the installer again.'); return; }

    setPhase('starting');
    let out = null;
    try {
      // SELF-HOSTED: there is no backend to create broadcasts or hand back RTMP URLs. The
      // studio sets the live status through the API, but the actual stream must be pushed by
      // the helper to each channel's own RTMP/stream key manually (full publisher URL below).
      await goLiveStatus();
      console.warn('self-hosted: stream publish requires a manual RTMP key — push from your encoder to each channel\'s server (e.g. ' +
        `${(destinations || []).filter((d) => selected.has(d.id)).map((d) => `${d.platform}:${d.serverUrl || '?'}`).join(', ')}).`);
      out = new HelperStream(mixer.videoTrack, mixer.audioTrack);
      out.onFailure = (message) => {
        if (outRef.current !== out) return;
        endHere(message);
        endLiveStatus();
        setBroadcast(null);
        setPhase('idle');
      };
      sendStartedAtRef.current = Date.now();
      outRef.current = out;
      setSendingHere(true);
      setBroadcast({ status: 'live', startedAt: new Date().toISOString(), destinationIds: ids });
      setPhase('live');
    } catch (error) {
      console.error('Go live failed:', error);
      out?.stop();
      endLiveStatus();
      setNotice(errorText(error));
      setPhase('idle');
    }
  };

  const endStream = async () => {
    if (!window.confirm('End the stream for everyone watching?')) return;
    setPhase('stopping');
    endHere();
    try {
      await endLiveStatus();
    } catch (error) {
      console.error('Stop failed:', error);
      setNotice(errorText(error));
    }
    setBroadcast(null);
    setPhase('idle');
  };

  const leave = () => {
    if (sendingHere && !window.confirm('Leaving the studio ends the stream. Leave anyway?')) return;
    navigate('/admin/dashboard');
  };

  // ----- Scenes -----
  const saveScene = (s) => {
    const exists = scenes.some((x) => x.id === s.id);
    saveList('scenes', exists ? scenes.map((x) => (x.id === s.id ? s : x)) : [...scenes, s]).catch((e) => console.error(e));
    setEditingScene(null);
  };
  const deleteScene = (s) => {
    if (!window.confirm(`Delete the "${s.name}" scene?`)) return;
    saveList('scenes', scenes.filter((x) => x.id !== s.id)).catch((e) => console.error(e));
    setEditingScene(null);
  };

  // Each channel's state: from the helper here, or from the streaming computer's report
  const outputs = streamer ? helper?.outputs : monitor?.helper?.outputs;
  const broadcastWithResults = broadcast ? { ...broadcast, results: outputs || [] } : null;

  const backgrounds = useMemo(() => (assets || []).filter((a) => a.kind === 'background'), [assets]);
  const elapsed = broadcast?.startedAt ? formatElapsed(now - new Date(broadcast.startedAt).getTime()) : '';
  const busy = phase === 'starting' || phase === 'stopping';
  const countdownLeft = scene.kind === 'countdown' && control.sceneEndsAt ? Math.max(0, control.sceneEndsAt - now) : 0;
  const roundButton = (on) => `relative w-12 h-12 rounded-full flex items-center justify-center transition ${on ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-100 text-church-red-dark hover:bg-red-200'}`;
  const swapAvailable = scene.kind === 'live' && screenAvailable && TWO_BOX.includes(control.layout);
  // Dragging works where the boxes are actually drawn: on the streaming computer's preview
  const canDragSwap = streamer && swapAvailable && !!mixer;
  const slotUnder = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return mixer?.slotAt(((e.clientX - rect.left) / rect.width) * WIDTH, ((e.clientY - rect.top) / rect.height) * HEIGHT) || null;
  };
  const helperMissing = streamer && helper === null;
  const helperOld = streamer && helper && olderThan(helper.version, HELPER_VERSION);
  const liveElsewhere = phase === 'live' && !sendingHere;

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#18181b] text-white font-sans">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={leave} className="p-2 rounded-lg hover:bg-white/10" aria-label="Back to dashboard"><Icon d={ICONS.back} /></button>
          <img src="/images/logo.png" alt="" className="w-8 h-8 object-contain bg-white rounded" />
          <h1 className="font-semibold truncate">Live Studio</h1>
        </div>

        <div className="flex items-center rounded-full bg-white/5 p-1 text-sm" role="group" aria-label="This computer is">
          {[['stream', 'Streaming computer'], ['cohost', 'Co-host']].map(([id, label]) => (
            <button key={id} onClick={() => setRole(id)} disabled={sendingHere && id !== role} aria-pressed={role === id}
              title={id === 'cohost' ? 'Control scenes and captions from this computer while another one streams' : 'This computer has the camera and sends the stream'}
              className={`px-3 py-1.5 rounded-full font-medium transition disabled:opacity-40 ${role === id ? 'bg-white text-[#18181b]' : 'text-white/70 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {streamer && (
            <button onClick={() => (helper ? checkHelper() : setShowHelperSetup(true))}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${helper ? 'bg-green-500/15 text-green-300' : helper === null ? 'bg-church-gold/15 text-church-gold' : 'bg-white/5 text-white/50'}`}>
              <span className={`w-2 h-2 rounded-full ${helper ? 'bg-green-400' : helper === null ? 'bg-church-gold' : 'bg-white/40'}`} />
              {helper ? 'Stream helper ready' : helper === null ? 'Set up stream helper' : 'Checking helper…'}
            </button>
          )}
          {phase === 'live' && (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-church-red text-white text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE {elapsed}
            </span>
          )}
          {phase === 'live' ? (
            <button onClick={endStream} disabled={busy} className="px-5 py-2.5 rounded-full bg-white text-[#18181b] font-semibold hover:bg-white/90 disabled:opacity-60 transition">End stream</button>
          ) : streamer ? (
            <button onClick={goLive} disabled={busy}
              className="px-6 py-2.5 rounded-full bg-church-red hover:bg-church-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold tracking-wide transition">
              {phase === 'starting' ? 'Starting…' : phase === 'stopping' ? 'Ending…' : 'GO LIVE'}
            </button>
          ) : (
            <span className="text-sm text-white/50">Not live</span>
          )}
        </div>
      </header>

      {(helperMissing || helperOld || helper?.warning || liveElsewhere || notice || !streamer) && (
        <div className="px-3 sm:px-5 pt-3 space-y-2">
          {helperMissing && (
            <div className="p-3 rounded-lg bg-church-gold/15 border border-church-gold/40 text-sm flex flex-wrap items-center justify-between gap-3">
              <span>To go live from this computer, set up the free stream helper once. If it's already installed, Chrome may be blocking it: allow local network access for this site.</span>
              <button onClick={() => setShowHelperSetup(true)} className="px-3 py-1.5 rounded-lg bg-church-gold text-[#18181b] font-semibold">Set up</button>
            </div>
          )}
          {helperOld && !sendingHere && (
            <div className="p-3 rounded-lg bg-church-gold/15 border border-church-gold/40 text-sm flex flex-wrap items-center justify-between gap-3">
              <span>A newer stream helper is available (it fixes Facebook and keeps one slow channel from stopping the others). Run the setup line again to update it.</span>
              <button onClick={() => setShowHelperSetup(true)} className="px-3 py-1.5 rounded-lg bg-church-gold text-[#18181b] font-semibold">Update</button>
            </div>
          )}
          {streamer && helper?.warning && sendingHere && (
            <div className="p-3 rounded-lg bg-church-gold/15 border border-church-gold/40 text-sm">{helper.warning}</div>
          )}
          {!streamer && (
            <div className="p-3 rounded-lg bg-church-blue/15 border border-church-blue/40 text-sm">
              <strong>Co-host:</strong> scenes, layouts, graphics, captions and QR codes you choose here show on the stream right away.
              The camera, microphone, screen sharing, music and GO LIVE are on the streaming computer.
            </div>
          )}
          {liveElsewhere && streamer && (
            <div className="p-3 rounded-lg bg-church-blue/15 border border-church-blue/40 text-sm">
              The church is live from another computer{broadcast?.startedByName ? ` (started by ${broadcast.startedByName})` : ''}. Switch to <strong>Co-host</strong> above to help run it from here.
            </div>
          )}
          {notice && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-400/40 text-sm flex justify-between gap-4">
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss"><Icon d={ICONS.close} className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Scenes */}
        <aside className="lg:w-56 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 p-3 lg:overflow-y-auto">
          <button onClick={() => setEditingScene({})} className="w-full mb-3 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold tracking-wide">+ ADD SCENE</button>
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-1">
            {scenes.map((s) => {
              const bg = images[s.backgroundId] || images[control.background];
              const active = s.id === scene.id;
              return (
                <div key={s.id} className="flex-shrink-0 w-40 lg:w-auto group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    <button onClick={() => setEditingScene(s)} className="p-1 text-white/50 hover:text-white" aria-label={`Edit ${s.name} scene`}><Icon d={ICONS.edit} className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => switchScene(s)} aria-label={`Show ${s.name} scene`}
                    className={`relative block w-full aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-church-navy to-church-navy-deep ${active ? 'ring-2 ring-church-blue' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                    {bg && <img src={bg.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                    <span className="absolute inset-0 flex items-center justify-center text-white/80">
                      <Icon d={s.kind === 'live' ? ICONS.camera : s.kind === 'countdown' ? 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' : ICONS.captions} className="w-6 h-6" />
                    </span>
                    {s.kind === 'countdown' && (
                      <span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black/60 text-xs font-mono">
                        {active && control.sceneEndsAt ? formatElapsed(countdownLeft + 999) : formatElapsed((Number(s.minutes) || 5) * 60000)}
                      </span>
                    )}
                    {active && <span className="absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded bg-church-blue text-[10px] font-bold uppercase">On screen</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Preview, layouts, controls */}
        <main className="flex-1 min-w-0 flex flex-col items-center p-3 sm:p-5 lg:overflow-y-auto">
          <div className="w-full max-w-5xl">
            <div className={`relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl ring-2 ${phase === 'live' ? 'ring-church-red' : 'ring-white/10'}`}>
              <div ref={previewRef} className="absolute inset-0" />
              {canDragSwap && (
                // Drag the camera box onto the screen box (or the other way) to trade places
                <div className={`absolute inset-0 touch-none ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onPointerDown={(e) => {
                    const from = slotUnder(e);
                    if (!from) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ from, over: from });
                  }}
                  onPointerMove={(e) => { if (drag) setDrag({ ...drag, over: slotUnder(e) }); }}
                  onPointerUp={() => {
                    if (drag?.over && drag.over.source !== drag.from.source) updateControl({ swap: !control.swap });
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}>
                  {drag && [drag.from, drag.over].filter(Boolean).map((r, i) => (
                    <span key={i} className={`absolute rounded-lg pointer-events-none ${i === 0 ? 'border-2 border-dashed border-white/80 bg-white/10' : drag.over.source !== drag.from.source ? 'ring-4 ring-church-blue bg-church-blue/20' : ''}`}
                      style={{ left: `${(r.x / WIDTH) * 100}%`, top: `${(r.y / HEIGHT) * 100}%`, width: `${(r.w / WIDTH) * 100}%`, height: `${(r.h / HEIGHT) * 100}%` }} />
                  ))}
                </div>
              )}
              {monitorFresh && monitor.image && <img src={monitor.image} alt="What the streaming computer is showing" className="absolute inset-0 w-full h-full object-cover" />}
              <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/55 text-xs font-medium">
                {streamer
                  ? (sendingHere ? 'On air: viewers see this' : 'Preview')
                  : monitorFresh ? 'From the streaming computer (updates every few seconds)' : 'Preview (graphics only: the streaming computer isn\'t open)'}
              </span>
            </div>

            {mediaError && streamer && <p className="mt-3 text-sm text-red-300">{mediaError}</p>}

            {scene.kind === 'live' ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Layout">
                {LAYOUTS.map((l) => {
                  const disabled = l.needsScreen && !screenAvailable;
                  const current = (screenAvailable ? control.layout : 'camera') === l.id;
                  return (
                    <button key={l.id} onClick={() => updateControl({ layout: l.id })} disabled={disabled}
                      title={disabled ? `${l.label} (share a screen on the streaming computer first)` : l.label} aria-label={l.label} aria-pressed={current}
                      className={`p-2 rounded-lg bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed ${current ? 'ring-2 ring-church-blue' : 'hover:bg-white/10'}`}>
                      <LayoutIcon boxes={l.boxes} />
                    </button>
                  );
                })}
                <button onClick={() => updateControl({ swap: !control.swap })} disabled={!swapAvailable}
                  title={swapAvailable ? 'Swap the camera and the screen (or drag one onto the other in the preview)' : 'Choose a layout with two boxes to swap them'}
                  aria-label="Swap camera and screen" aria-pressed={!!control.swap}
                  className={`px-3 rounded-lg bg-white/5 transition text-sm font-medium flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${control.swap ? 'ring-2 ring-church-blue' : 'hover:bg-white/10'}`}>
                  <Icon d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" className="w-5 h-5" /> Swap
                </button>
                <button onClick={() => setShowStyle(true)} title="Camera shape and rounded corners" aria-label="Box style"
                  className="px-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm font-medium flex items-center gap-1.5">
                  <Icon d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" className="w-5 h-5" /> Style
                </button>
              </div>
            ) : (
              <p className="mt-4 text-center text-sm text-white/50">
                Showing the "{scene.name}" scene. Click a Live scene to show the camera{screenAvailable ? ' and screen' : ''}.
              </p>
            )}

            {streamer ? (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button onClick={() => { mixer?.resumeAudio(); setMicMuted((v) => !v); }} className={roundButton(!micMuted)} aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'} title={micMuted ? 'Unmute' : 'Mute'}>
                  <Icon d={ICONS.mic} className="w-6 h-6" />
                  {micMuted && <span className="absolute w-7 h-0.5 bg-current rotate-45 rounded" />}
                  <span className="absolute -right-1 bottom-1 w-1.5 h-8 rounded-full bg-white/10 overflow-hidden flex items-end">
                    <span ref={meterRef} className={`block w-full ${micMuted ? 'bg-white/30' : 'bg-green-400'}`} style={{ height: '0%' }} />
                  </span>
                </button>
                <button onClick={() => { mixer?.resumeAudio(); setCameraOn((v) => !v); }} className={roundButton(cameraOn)} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} title={cameraOn ? 'Camera off' : 'Camera on'}>
                  <Icon d={ICONS.camera} className="w-6 h-6" />
                  {!cameraOn && <span className="absolute w-7 h-0.5 bg-current rotate-45 rounded" />}
                </button>
                {canShareScreen && (
                  <button onClick={sharing ? stopSharing : startSharing}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition ${sharing ? 'bg-church-blue text-white hover:brightness-110' : 'bg-white/10 hover:bg-white/20'}`}
                    aria-label={sharing ? 'Stop sharing screen' : 'Share screen'} title={sharing ? 'Stop sharing' : 'Share screen'}>
                    <Icon d={ICONS.screen} className="w-6 h-6" />
                  </button>
                )}
                {canShareScreen && (
                  <button
                    onClick={sharing ? stopSharing : captureProclaim}
                    className={`h-12 px-4 rounded-full flex items-center gap-2 font-semibold text-sm transition border-2 ${
                      sharing
                        ? 'bg-church-blue text-white border-church-blue hover:brightness-110'
                        : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                    }`}
                    aria-label={sharing ? 'Stop showing Proclaim' : 'Show Proclaim (lyrics and announcements)'}
                    title={sharing ? 'Stop showing Proclaim' : 'Show Proclaim — pick the Faithlife Proclaim window'}
                  >
                    <Icon d={ICONS.screen} className="w-5 h-5" />
                    {sharing ? 'Proclaim on' : 'Show Proclaim'}
                  </button>
                )}
                <button onClick={() => setShowSettings(true)} className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition" aria-label="Camera and microphone settings" title="Settings">
                  <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-6 h-6" />
                </button>
              </div>
            ) : (
              monitorFresh && (
                <p className="mt-5 text-center text-sm text-white/60">
                  Streaming computer: camera {monitor.cameraOn ? 'on' : 'off'} · microphone {monitor.micMuted ? 'muted' : 'on'} · screen {monitor.sharing ? 'shared' : 'not shared'}
                </p>
              )
            )}
            {streamer && sharing && <p className="mt-3 text-center text-xs text-white/40">Sharing a tab with a video? Tick "Also share tab audio" in the browser's share window.</p>}
          </div>
        </main>

        {/* Right panel + icon rail */}
        <div className="flex flex-col-reverse lg:flex-row border-t lg:border-t-0 lg:border-l border-white/10">
          <section className="lg:w-[340px] p-4 lg:overflow-y-auto bg-[#1f1f23]" aria-label={PANELS.find((p) => p.id === panel)?.label}>
            <h2 className="text-lg font-semibold mb-4">{PANELS.find((p) => p.id === panel)?.label}</h2>
            {/* All panels stay mounted (music keeps playing when you switch) */}
            <div className={panel === 'channels' ? '' : 'hidden'}>
              <DestinationsPanel destinations={destinations} selected={selected} onToggle={toggleSelected}
                phase={streamer ? phase : (phase === 'idle' ? 'idle' : 'live')}
                broadcast={broadcastWithResults} uid={uid} onRemove={removeDestination}
                auto={auto} stream={library?.stream} onStream={(value) => saveList('stream', value).catch((e) => console.error(e))}
                onConnect={connectPlatform} onDisconnect={disconnectPlatform} onChoosePage={choosePage} connectBusy={connectBusy} />
            </div>
            <div className={panel === 'graphics' ? '' : 'hidden'}>
              <GraphicsPanel assets={assets} active={{ logo: control.logo, overlay: control.overlay, background: control.background }}
                onToggle={(kind, id) => updateControl({ [kind]: control[kind] === id ? '' : id })}
                clip={clipForPanel} onClip={toggleClip} />
            </div>
            <div className={panel === 'captions' ? '' : 'hidden'}>
              {library && (
                <CaptionsPanel library={library} saveList={saveList}
                  activeLowerThird={control.lowerThird?.id} activeTicker={control.ticker?.id}
                  onLowerThird={(item) => updateControl({ lowerThird: control.lowerThird?.id === item.id ? null : { id: item.id, title: item.title, subtitle: item.subtitle || '' } })}
                  onTicker={(item) => updateControl({ ticker: control.ticker?.id === item.id ? null : { id: item.id, text: item.text } })}
                  tickerSpeed={control.tickerSpeed || 110} onTickerSpeed={(v) => updateControl({ tickerSpeed: v })} />
              )}
            </div>
            <div className={panel === 'chat' ? '' : 'hidden'}>
              <ChatPanel messages={chatMessages} live={phase === 'live'} errors={chatErrors}
                available={{ youtube: !!auto?.connected, facebook: !!auto?.facebookConnected }}
                shownId={control.chatShown?.id} onShow={showChat} onSend={sendChat} facebookScopes={autoInfo?.facebookScopes} />
            </div>
            <div className={panel === 'qr' ? '' : 'hidden'}>
              {library && (
                <QrPanel library={library} saveList={saveList} activeQr={control.qr?.id}
                  onQr={(item) => updateControl({ qr: control.qr?.id === item.id ? null : { id: item.id, label: item.label || '', url: item.url } })} />
              )}
            </div>
            <div className={panel === 'music' ? '' : 'hidden'}>
              {streamer
                ? <MusicPanel mixer={mixer} />
                : <p className="text-sm text-white/60">Music plays from files on the streaming computer, so it's chosen there.</p>}
            </div>
          </section>
          <nav className="flex lg:flex-col gap-1 p-2 overflow-x-auto bg-[#18181b]" aria-label="Studio panels">
            {PANELS.map((p) => (
              <button key={p.id} onClick={() => setPanel(p.id)} aria-pressed={panel === p.id}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg min-w-[64px] text-xs transition ${panel === p.id ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                <Icon d={p.icon} className="w-5 h-5" />
                {p.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {editingScene && (
        <SceneForm scene={editingScene} backgrounds={backgrounds} onSave={saveScene} onDelete={() => deleteScene(editingScene)} onClose={() => setEditingScene(null)} />
      )}
      {showStyle && (
        <StyleModal shape={control.cameraShape || 'rect'} cameraRadius={control.cameraRadius ?? 12} screenRadius={control.screenRadius ?? 12}
          layout={screenAvailable ? control.layout : 'camera'} placement={control.placement}
          onChange={(changes) => updateControl(changes)} onClose={() => setShowStyle(false)} />
      )}
      {showSettings && (
        <SettingsModal devices={devices} cameraId={cameraId} micId={micId} onCamera={setCameraId} onMic={setMicId}
          mirror={mirrorCamera} onMirror={changeMirror} onClose={() => setShowSettings(false)} />
      )}
      {showHelperSetup && <HelperSetupModal onClose={() => setShowHelperSetup(false)} onCheck={checkHelper} />}
    </div>
  );
};

export default LiveStudio;
