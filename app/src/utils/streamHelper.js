// Talks to the Church Stream Helper on this computer (public/stream-helper/helper.mjs), which sends
// the stream to YouTube, Facebook, and other channels with ffmpeg.
//
// The studio's picture and sound are recorded with MediaRecorder in quarter-second pieces and
// passed to the helper in order. Chrome may ask once to "access other apps and services on this
// device" (its local network permission): that's this, and it must be allowed.

import { SITE_URL } from '../firebase/config';

export const HELPER_URL = 'http://127.0.0.1:51735';
export const INSTALL_COMMAND = `curl -fsSL ${SITE_URL}/stream-helper/install.sh | bash`;

// { ok, version, live, outputs, lastError }, or null if the helper isn't running (or Chrome blocked it)
export const getHelperStatus = async () => {
  try {
    const res = await fetch(`${HELPER_URL}/status`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const post = async (path, body, type = 'application/json') => {
  const res = await fetch(`${HELPER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': type },
    body: type === 'application/json' ? JSON.stringify(body || {}) : body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'The stream helper refused the request.');
  return data;
};

const pickMimeType = () => [
  'video/webm;codecs=h264,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
].find((t) => window.MediaRecorder?.isTypeSupported(t));

export class HelperStream {
  constructor(videoTrack, audioTrack) {
    this.stream = new MediaStream([videoTrack, audioTrack].filter(Boolean));
    this.session = null;
    this.recorder = null;
    this.queue = [];
    this.sending = false;
    this.stopped = false;
    this.onFailure = null; // called with a message if sending to the helper breaks
  }

  async start(urls) {
    const mimeType = pickMimeType();
    if (!mimeType) throw new Error('This browser cannot record the stream. Use Google Chrome.');
    const { session } = await post('/start', { urls });
    this.session = session;
    // High quality: it only travels inside this computer, and the helper re-encodes it
    this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0 && !this.stopped) {
        this.queue.push(e.data);
        this.pump();
      }
    };
    this.recorder.start(250);
  }

  async pump() {
    if (this.sending) return;
    this.sending = true;
    while (this.queue.length > 0 && !this.stopped) {
      const piece = this.queue.shift();
      try {
        await post(`/chunk?session=${encodeURIComponent(this.session)}`, piece, 'application/octet-stream');
      } catch (error) {
        this.stopped = true;
        try { this.recorder?.stop(); } catch { /* already stopped */ }
        this.onFailure?.('The stream helper stopped receiving video, so the stream ended. Is it still running?');
        break;
      }
    }
    this.sending = false;
  }

  async stop() {
    this.stopped = true;
    try { if (this.recorder?.state !== 'inactive') this.recorder?.stop(); } catch { /* already stopped */ }
    if (this.session) await post(`/stop?session=${encodeURIComponent(this.session)}`).catch(() => {});
  }
}
