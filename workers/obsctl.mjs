#!/usr/bin/env node
// obsctl — one-button "Go Live" for Lakeview Fellowship.
//
// Runs on the streaming PC that has OBS open. It connects to OBS over
// obs-websocket (localhost:4455 by default), starts/ends OBS streaming, and
// flips the church site's live flag so the homepage shows the YouTube embed
// + "Watch on Facebook" button.
//
// Usage:
//   node obsctl.mjs status    read current OBS stream state (+ site flag if token set)
//   node obsctl.mjs go        start OBS stream AND flip the site to LIVE
//   node obsctl.mjs stop      stop OBS stream AND flip the site off
//
// Env:
//   OBS_PASSWORD   (required) obs-websocket password (OBS → Tools → WebSocket Server)
//   LW_TOKEN       optional bearer token from the members area; without it, OBS
//                  streaming starts but the SITE flag is not flipped (told plainly).
//   OBS_WS_URL     optional default ws://127.0.0.1:4455
//   LW_API         optional default https://lakeview-fellowship-backend.inthewake-jerusha.workers.dev
//
// Zero deps: uses Node's built-in WebSocket + WebCrypto (Node >= 22).

const OBS_WS = process.env.OBS_WS_URL || 'ws://127.0.0.1:4455';
const OBS_PASS = process.env.OBS_PASSWORD || '';
const LW_API = process.env.LW_API || 'https://lakeview-fellowship-backend.inthewake-jerusha.workers.dev';
const LW_TOKEN = process.env.LW_TOKEN || '';

const cmd = process.argv[2] || 'status';
const log = (m) => console.log(`[obsctl] ${m}`);

const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

function client(ws) {
  const pending = new Map();
  let id = 0;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.op === 7 && msg.d && pending.has(msg.d.requestId)) {
      const { res, rej, name } = pending.get(msg.d.requestId);
      pending.delete(msg.d.requestId);
      if (msg.d.requestStatus && !msg.d.requestStatus.result) {
        rej(new Error(`${name}: ${msg.d.requestStatus.comment || 'request failed'}`));
      } else {
        res(msg.d.requestData || {});
      }
    }
  };
  const req = (requestType, requestData = {}, overrides = {}) => new Promise((res, rej) => {
    const requestId = String(++id);
    pending.set(requestId, { res, rej, name: requestType });
    ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData, ...overrides } }));
  });
  return { req };
}

async function openIdentified() {
  if (!OBS_PASS) {
    log('OBS_PASSWORD is not set; refusing to connect. (Set OBS_PASSWORD from OBS → Tools → WebSocket Server.)');
    throw new Error('missing OBS_PASSWORD');
  }
  const ws = new WebSocket(OBS_WS);
  const connected = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`cannot reach OBS at ${OBS_WS}`)); });
  await connected;

  // v5 handshake: server sends a challenge (op 0) if auth is required.
  const challenge = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('no challenge from OBS (is WebSocket Server on?)')), 5000);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) { clearTimeout(t); res(m.d); }
    };
  });
  let auth = {};
  if (challenge && challenge.authentication) {
    const secret = await sha256(OBS_PASS + challenge.authentication.salt);
    auth = { authentication: await sha256(secret + challenge.authentication.challenge) };
  }
  ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, ...auth } }));

  // Confirm the identify landed: a hello/identified ack. obs-websocket doesn't ack
  // Identify with a reply; first request will error loudly if auth failed.
  return client(ws);
}

async function main() {
  let c;
  try {
    c = await openIdentified();
  } catch (e) {
    log(`error: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    if (cmd === 'status') {
      const st = await c.req('GetStreamStatus');
      log(`OBS stream ${st.outputActive ? 'is LIVE' : 'is idle'}`);
      if (LW_TOKEN) {
        const r = await fetch(`${LW_API}/live/status`);
        const s = await r.json();
        log(`site /live/status -> live=${!!s.live}`);
      } else {
        log('LW_TOKEN unset — not checking the site flag.');
      }
    } else if (cmd === 'go') {
      await c.req('StartStream');
      log('OBS stream started (StartStream). If you use a second RTMP output for Facebook, start it in OBS too or add it below.');
      if (LW_TOKEN) {
        await fetch(`${LW_API}/live/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LW_TOKEN}` }, body: JSON.stringify({ live: true }) });
        log('Site flag flipped to LIVE.');
      } else {
        log('LW_TOKEN unset — OBS is live but the SITE flag was NOT flipped.');
      }
    } else if (cmd === 'stop') {
      await c.req('StopStream');
      log('OBS stream stopped.');
      if (LW_TOKEN) {
        await fetch(`${LW_API}/live/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LW_TOKEN}` }, body: JSON.stringify({ live: false }) });
        log('Site flag flipped OFF.');
      }
    } else {
      log(`Unknown command "${cmd}". Use: status | go | stop`);
      process.exitCode = 2;
    }
    c?.close && c.close();
  } catch (e) {
    log(`error: ${e.message}`);
    process.exitCode = 1;
  }
}

main();
