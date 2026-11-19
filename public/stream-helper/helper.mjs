// Church Stream Helper: sends Live Studio's stream to YouTube, Facebook, and other channels.
//
// Browsers can't send video to YouTube or Facebook themselves (that needs RTMP), so this small
// program runs on the streaming computer. The Live Studio page (example.org/admin/live) sends
// it the finished picture and sound, and ffmpeg encodes them once and sends a copy to every
// channel at the same time. Nothing goes through any paid service.
//
// Installed and started automatically at login by install.sh (same folder on the website).
// It only listens on this computer (127.0.0.1) and only accepts requests from the church's
// own website, so other websites can't use it.
//
// API (all JSON except /chunk):
//   GET  /status                   { ok, version, live, outputs: [{ status, error }], lastError }
//   POST /start  { urls: [...] }   starts ffmpeg; returns { session }
//   POST /chunk?session=ID         a piece of the WebM recording (binary body)
//   POST /stop?session=ID          ends the stream

import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const VERSION = '1.2.0';
const PORT = Number(process.env.STREAM_HELPER_PORT || 51735);
const HERE = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.STREAM_HELPER_FFMPEG || (existsSync(join(HERE, 'ffmpeg')) ? join(HERE, 'ffmpeg') : 'ffmpeg');
// EDIT: the websites allowed to use this helper: your domain (with and without www) and your
// Firebase Hosting addresses. Keep localhost for local development.
const ALLOWED_ORIGINS = new Set([
  'https://example.org',
  'https://www.example.org',
  'https://your-firebase-project-id.web.app',
  'https://your-firebase-project-id.firebaseapp.com',
  'http://localhost:5173'
]);
const MAX_OUTPUTS = 6;
const STALL_MS = 15000; // no video from the studio for this long: the tab closed, so stop

const log = (...args) => console.log(new Date().toISOString(), ...args);

// Prefer the x264 encoder; fall back to the Mac's built-in hardware encoder
const pickEncoder = () => {
  try {
    const out = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout || '';
    if (/\blibx264\b/.test(out)) return 'libx264';
    if (/\bh264_videotoolbox\b/.test(out)) return 'h264_videotoolbox';
  } catch {
    // reported below
  }
  return null;
};
const ENCODER = pickEncoder();
log(`Church Stream Helper ${VERSION} using ${FFMPEG} (${ENCODER || 'ffmpeg not found'})`);

let session = null; // { id, proc, outputs, startedAt, lastChunkAt, writing, stopping }
let lastError = '';

// A tee output is "[options]url"; these characters would break that syntax
const teeEscape = (url) => url.replace(/[\\|[\]]/g, (c) => `\\${c}`);

const videoArgs = () => (ENCODER === 'libx264'
  ? ['-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'high']
  : ['-c:v', 'h264_videotoolbox', '-realtime', '1', '-profile:v', 'high']);

// Secure channels (rtmps://, e.g. Facebook) go through a small relay here instead of ffmpeg's own
// TLS: on Mac, ffmpeg's TLS (Apple SecureTransport) waits for the server between packets, so a
// Facebook stream crawls and stalls. ffmpeg sends plain RTMP to 127.0.0.1, and Node encrypts it.
const tlsRelay = (rtmpsUrl) => new Promise((resolve, reject) => {
  const target = new URL(rtmpsUrl);
  const host = target.hostname;
  const port = Number(target.port || 443);
  const server = net.createServer((local) => {
    const remote = tls.connect({ host, port, servername: host });
    local.setNoDelay(true);
    remote.setNoDelay(true);
    local.pipe(remote);
    remote.pipe(local);
    const close = () => { local.destroy(); remote.destroy(); };
    local.on('error', close);
    remote.on('error', (error) => { log(`Secure connection to ${host} failed: ${error.message}`); close(); });
    local.on('close', close);
    remote.on('close', close);
  });
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    resolve({ server, url: `rtmp://127.0.0.1:${server.address().port}${target.pathname}${target.search}` });
  });
});

const startStream = async (channelUrls) => {
  // Where ffmpeg actually sends each channel (rtmps ones through a local relay)
  const relays = [];
  const urls = [];
  for (const u of channelUrls) {
    if (/^rtmps:\/\//i.test(u)) {
      const relay = await tlsRelay(u);
      relays.push(relay.server);
      urls.push(relay.url);
    } else {
      urls.push(u);
    }
  }
  const id = randomUUID();
  const outputs = urls.map(() => ({ status: 'connecting', error: '' }));
  const args = [
    '-hide_banner', '-loglevel', 'warning', '-stats_period', '5',
    '-fflags', '+genpts', '-thread_queue_size', '1024', '-i', 'pipe:0',
    '-map', '0:v:0', '-map', '0:a:0?',
    ...videoArgs(),
    '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
    '-b:v', '4000k', '-maxrate', '4000k', '-bufsize', '8000k',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
    '-flags', '+global_header',
    // Each channel gets its own buffer (fifo), so one slow or stuck channel (it stops reading)
    // can't hold up the others. A channel that falls too far behind drops video and reconnects.
    '-f', 'tee', '-use_fifo', '1',
    '-fifo_options', 'queue_size=900:drop_pkts_on_overflow=1:attempt_recovery=1:recovery_wait_time=2:recover_any_error=1:restart_with_keyframe=1',
    urls.map((u) => `[f=flv:onfail=ignore]${teeEscape(u)}`).join('|')
  ];
  const proc = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  const s = { id, proc, outputs, relays, startedAt: Date.now(), lastChunkAt: Date.now(), writing: false, stopping: false };
  const fifoIndex = new Map(); // ffmpeg's per-channel buffer address -> channel number

  proc.stdin.on('error', () => {}); // ffmpeg exiting while a chunk is being written
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (text) => {
    for (const line of text.split(/\r|\n/).filter(Boolean)) {
      // e.g. "Slave muxer #1 failed: Connection refused, continuing with 1/2 slaves."
      const failed = line.match(/Slave muxer #(\d+) failed: (.*?)(, continuing|$)/);
      if (failed && outputs[Number(failed[1])]) {
        outputs[Number(failed[1])] = { status: 'failed', error: failed[2] };
      }
      // e.g. "Slave '[f=flv:onfail=ignore]rtmp://...': error opening: ..."
      const openFailed = line.match(/Slave '\[[^\]]*\](.*?)': (error.*)/);
      if (openFailed) {
        const index = urls.findIndex((u) => teeEscape(u) === openFailed[1]);
        if (index >= 0) outputs[index] = { status: 'failed', error: openFailed[2] };
      }
      // e.g. "[fifo @ 0x...] Error opening rtmps://...: Connection refused" (it will retry)
      const fifoError = line.match(/\[fifo @ (0x[0-9a-f]+)\] Error (?:opening|writing) (.*?): (.*)/);
      if (fifoError) {
        const index = urls.indexOf(fifoError[2]);
        if (index >= 0) {
          fifoIndex.set(fifoError[1], index);
          outputs[index] = { status: 'reconnecting', error: fifoError[3] };
          setTimeout(() => { if (outputs[index]?.status === 'reconnecting') outputs[index] = { status: 'active', error: '' }; }, 15000);
        }
      }
      // e.g. "[fifo @ 0x...] FIFO queue full": a channel isn't keeping up
      const full = line.match(/\[fifo @ (0x[0-9a-f]+)\] FIFO queue full/);
      if (full) {
        const index = fifoIndex.get(full[1]);
        if (index !== undefined) outputs[index] = { status: 'behind', error: 'Not keeping up; reconnecting' };
        else s.warning = 'One channel is not keeping up and is being reconnected.';
      }
      if (!line.startsWith('frame=')) log('ffmpeg:', line.replace(/rtmps?:\/\/[^\s]+?(?=:?(\s|$))/g, (u) => `[channel ${urls.indexOf(u) + 1 || '?'}]`));
    }
  });
  proc.on('exit', (code) => {
    log(`ffmpeg ended (code ${code})`);
    relays.forEach((r) => r.close());
    if (session === s) {
      if (!s.stopping) lastError = 'The stream stopped unexpectedly. Check the internet connection and stream keys.';
      session = null;
    }
  });
  // Outputs that haven't failed after a few seconds are sending
  setTimeout(() => {
    outputs.forEach((o, i) => { if (o.status === 'connecting') outputs[i] = { status: 'active', error: '' }; });
  }, 6000);
  return s;
};

const stopStream = (s) => {
  if (!s || s.stopping) return;
  s.stopping = true;
  try { s.proc.stdin.end(); } catch { /* already closed */ }
  // Let ffmpeg finish cleanly, then make sure it's gone
  setTimeout(() => { try { s.proc.kill('SIGKILL'); } catch { /* gone */ } }, 4000);
  setTimeout(() => s.relays.forEach((r) => r.close()), 5000);
  if (session === s) session = null;
};

setInterval(() => {
  if (session && Date.now() - session.lastChunkAt > STALL_MS) {
    if (session.writing) {
      log('ffmpeg stopped taking video, so the stream was stopped.');
      lastError = 'The streaming program stopped taking video (a channel may have stopped responding), so the stream ended. Try again.';
    } else {
      log('No video from the studio for a while, so the stream was stopped.');
      lastError = 'The studio stopped sending video (the tab was closed or lost connection), so the stream ended.';
    }
    stopStream(session);
  }
}, 3000);

const readBody = (req, limit) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  // Browsers always send Origin on these requests, so this keeps other websites out
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.writeHead(403).end();
    return;
  }
  const cors = origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  } : {};
  const json = (status, body) => {
    res.writeHead(status, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end();
    return;
  }

  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/status') {
      json(200, {
        ok: !!ENCODER,
        version: VERSION,
        live: !!session,
        outputs: session ? session.outputs : [],
        warning: session?.warning || '',
        lastError
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/start') {
      if (!ENCODER) { json(500, { error: 'ffmpeg is missing. Run the installer again.' }); return; }
      const { urls } = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}');
      const clean = Array.isArray(urls) ? urls.filter((u) => typeof u === 'string' && /^rtmps?:\/\/\S+$/i.test(u)).slice(0, MAX_OUTPUTS) : [];
      if (clean.length === 0) { json(400, { error: 'No channels to stream to.' }); return; }
      if (session) stopStream(session);
      lastError = '';
      session = await startStream(clean);
      log(`Stream started to ${clean.length} channel(s)`);
      json(200, { session: session.id });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/chunk') {
      if (!session || session.id !== url.searchParams.get('session')) { json(409, { error: 'Not streaming.' }); return; }
      const s = session;
      const body = await readBody(req, 20 * 1024 * 1024);
      s.lastChunkAt = Date.now();
      if (!s.proc.stdin.write(body)) {
        s.writing = true;
        await new Promise((r) => s.proc.stdin.once('drain', r));
        s.writing = false;
      }
      json(200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/stop') {
      if (session && (!url.searchParams.get('session') || session.id === url.searchParams.get('session'))) {
        stopStream(session);
        log('Stream stopped from the studio');
      }
      lastError = '';
      json(200, { ok: true });
      return;
    }

    json(404, { error: 'Not found' });
  } catch (error) {
    log('Request failed:', error.message);
    json(500, { error: 'The helper had a problem with that request.' });
  }
});

server.listen(PORT, '127.0.0.1', () => log(`Listening on http://127.0.0.1:${PORT}`));
