/**
 * Lakeview Fellowship Church — Cloudflare Worker backend.
 * Replaces Firebase for the data layer. Runs on Workers + D1 (free tier).
 *
 * Auth: opaque bearer token (crypto-random 32 bytes) stored as sha256 in D1;
 * password hashed with PBKDF2-HMAC-SHA256 (WebCrypto). Invitation-only signup:
 * an owner creates an invite; the invited email sets a password once.
 *
 * Routes:
 *   POST /auth/login                 {email,password} -> {token,member}
 *   POST /auth/logout                (bearer)
 *   POST /auth/accept-invite         {code,email,password} -> {token,member}
 *   POST /auth/reset                 {email} -> {ok} (mailto note; wire SMTP later)
 *   GET  /auth/me                    (bearer) -> {member}
 *   GET  /members                    (bearer, owner) -> [member]
 *   POST /members/invite             (bearer, owner) {email,role?} -> {code}
 *   POST /members/remove             (bearer, owner) {id} -> {ok}
 *   GET  /events?since=YYYY-MM-DD    public -> [event] (sparse: id,date,type,en,es,time,place)
 *   POST /events                     (bearer) {date,type?,en,es?,time?,place?}
 *   PUT  /events/:id                 (bearer) {...}
 *   DELETE /events/:id               (bearer)
 *   GET  /live/status                public -> {live,youtube,facebook,videoId,heartbeatAt}
 *   POST /live/state                 (bearer) {live:true|false} -> updates public flag + state
 *   POST /live/destinations          (bearer) upsert destinations/keys
 *   GET  /_health                    {ok:true}
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const AUTH_HEADER_NAME = 'authorization';
const TOKEN_HEADER_RE = /^Bearer\s+([A-Za-z0-9\-_=]+)$/i;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const STALE_LIVE_MS = 90 * 1000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      // CORS for the React app + public site
      const cors = (res, extra = {}) =>
        new Response(res.body, { status: res.status, headers: { ...JSON_HEADERS, ...extra, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' } });

      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

      // Health
      if (path === '/_health') return cors(json({ ok: true }));

      const db = env.DB;
      const body = request.method !== 'GET' && request.method !== 'DELETE' ? await request.json().catch(() => ({})) : {};

      // Public events listing
      if (path === '/events' && request.method === 'GET') {
        const since = url.searchParams.get('since') || '1900-01-01';
        const rows = await db.prepare('SELECT id,date,type,en,es,time,place FROM events WHERE date >= ? ORDER BY date LIMIT 500')
          .bind(since).all();
        return cors(json(rows.results));
      }

      // Public live status
      if (path === '/live/status' && request.method === 'GET') {
        const row = await db.prepare('SELECT * FROM public_live WHERE id = 1').first();
        const fresh = row && row.live === 1 && (!row.heartbeat_at || Date.now() - Date.parse(row.heartbeat_at) < STALE_LIVE_MS);
        return cors(json({
          live: fresh ? true : false,
          youtube: fresh ? !!row.youtube : false,
          facebook: fresh ? !!row.facebook : false,
          youtubeVideoId: fresh ? (row.youtube_video_id || '') : '',
          heartbeatAt: row?.heartbeat_at || null
        }));
      }

      // ---- authenticated handlers below ----
      const session = await resolveSession(request, db);
      const member = session ? (await db.prepare('SELECT * FROM members WHERE id = ?').bind(session.member_id).first()) : null;
      const authed = member && member.account_status === 'active';

      // Auth routes that work pre-login / with their own rules
      // One-time first-owner bootstrap: guarded by env BOOTSTRAP_KEY. Delete the
      // seed/route once the real owner exists (or move to a secret one-shot).
      if (path === '/auth/bootstrap' && request.method === 'POST') {
        if (!env.BOOTSTRAP_KEY || body.key !== env.BOOTSTRAP_KEY) return cors(json({ error: 'forbidden' }, 403));
        if (typeof body.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return cors(json({ error: 'invalid-email' }, 400));
        if (typeof body.password !== 'string' || body.password.length < 8) return cors(json({ error: 'password-too-short' }, 400));
        const existing = await db.prepare('SELECT id FROM members LIMIT 1').first();
        if (existing) return cors(json({ error: 'already-bootstrapped' }, 400));
        const id = crypto.randomUUID();
        const name = (body.name || 'Owner').trim();
        await db.prepare('INSERT INTO members (id, name, email, pass_hash, role, account_status, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(id, name, norm(body.email), await hashPassword(body.password), 'owner', 'active', new Date().toISOString()).run();
        const token = await issueSession(db, id);
        return cors(json({ token, member: publicMember(await db.prepare('SELECT * FROM members WHERE id = ?').bind(id).first()) }));
      }

      if (path === '/auth/login' && request.method === 'POST') {
        const row = await db.prepare('SELECT * FROM members WHERE email = ?').bind(norm(body.email)).first();
        if (!row || !(await verifyPassword(body.password, row.pass_hash))) return cors(json({ error: 'invalid-credentials' }, 401));
        await db.prepare("UPDATE members SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), row.id).run();
        const token = await issueSession(db, row.id);
        return cors(json({ token, member: publicMember(row) }));
      }

      if (path === '/auth/accept-invite' && request.method === 'POST') {
        const iv = await db.prepare("SELECT * FROM invites WHERE code = ? AND used_at IS NULL AND lower(email) = lower(?)")
          .bind(body.code || '', body.email || '').first();
        if (!iv) return cors(json({ error: 'invite-not-found' }, 400));
        if (typeof body.password !== 'string' || body.password.length < 8) return cors(json({ error: 'password-too-short' }, 400));
        const existing = await db.prepare('SELECT id FROM members WHERE lower(email) = lower(?)').bind(body.email).first();
        const id = existing ? existing.id : crypto.randomUUID();
        const hash = await hashPassword(body.password);
        if (existing) {
          await db.prepare("UPDATE members SET pass_hash = ?, account_status = 'active', role = ? WHERE id = ?").bind(hash, iv.role, id).run();
        } else {
          await db.prepare('INSERT INTO members (id, name, email, pass_hash, role, account_status, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(id, (body.name || '').trim() || 'Church Member', norm(body.email), hash, iv.role, 'active', new Date().toISOString()).run();
        }
        await db.prepare('UPDATE invites SET used_at = ? WHERE code = ?').bind(new Date().toISOString(), body.code).run();
        const token = await issueSession(db, id);
        return cors(json({ token, member: publicMember(await db.prepare('SELECT * FROM members WHERE id = ?').bind(id).first()) }));
      }

      if (!authed) return cors(json({ error: 'unauthorized' }, 401));

      // Logout
      if (path === '/auth/logout' && request.method === 'POST') {
        await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.token_hash).run();
        return cors(json({ ok: true }));
      }

      // Me
      if (path === '/auth/me' && request.method === 'GET') return cors(json({ member: publicMember(member) }));

      // Members management (owner only)
      const isOwner = member.role === 'owner';
      if (path === '/members' && request.method === 'GET') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        const rows = await db.prepare("SELECT id,name,email,role,account_status FROM members WHERE account_status != 'removed' ORDER BY name").all();
        return cors(json(rows.results));
      }
      if (path === '/members/invite' && request.method === 'POST') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        if (typeof body.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return cors(json({ error: 'invalid-email' }, 400));
        const code = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
        await db.prepare('INSERT INTO invites (code, email, role, created_by, created_at) VALUES (?,?,?,?,?)')
          .bind(code, norm(body.email), body.role === 'owner' ? 'owner' : 'admin', member.id, new Date().toISOString()).run();
        return cors(json({ code }));
      }
      if (path === '/members/remove' && request.method === 'POST') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        if (!body.id || body.id === member.id) return cors(json({ error: 'cannot-remove-self' }, 400));
        await db.prepare("UPDATE members SET account_status = 'removed' WHERE id = ?").bind(body.id).run();
        await db.prepare('DELETE FROM sessions WHERE member_id = ?').bind(body.id).run();
        return cors(json({ ok: true }));
      }

      // Events admin
      if (path === '/events' && request.method === 'POST') {
        if (!validEvent(body)) return cors(json({ error: 'invalid-event' }, 400));
        const r = await db.prepare('INSERT INTO events (date,type,en,es,time,place,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .bind(body.date, body.type === 'holiday' ? 'holiday' : 'church', body.en, body.es || '', body.time || null, body.place || null, member.id, new Date().toISOString()).run();
        return cors(json({ id: r.meta.last_row_id }));
      }
      const evMatch = path.match(/^\/events\/(\d+)$/);
      if (evMatch && request.method === 'PUT') {
        if (!validEvent(body)) return cors(json({ error: 'invalid-event' }, 400));
        await db.prepare('UPDATE events SET date=?,type=?,en=?,es=?,time=?,place=? WHERE id=?')
          .bind(body.date, body.type === 'holiday' ? 'holiday' : 'church', body.en, body.es || '', body.time || null, body.place || null, evMatch[1]).run();
        return cors(json({ ok: true }));
      }
      if (evMatch && request.method === 'DELETE') {
        await db.prepare('DELETE FROM events WHERE id = ?').bind(evMatch[1]).run();
        return cors(json({ ok: true }));
      }

      // Live studio manual state (streaming helper + admin)
      if (path === '/live/state' && request.method === 'POST') {
        const live = body.live === true;
        const now = new Date().toISOString();
        if (live) {
          await db.prepare(`UPDATE live_state SET status='live', started_by=?, started_by_name=?, started_at=?, heartbeat_at=? WHERE id=1`)
            .bind(member.id, member.name || '', now, now).run();
          await db.prepare(`UPDATE public_live SET live=1, started_at=?, heartbeat_at=? WHERE id=1`).bind(now, now).run();
        } else {
          await db.prepare(`UPDATE live_state SET status='idle', ended_at=?, ended_by=?, ended_by_name=? WHERE id=1`)
            .bind(now, member.id, member.name || '').run();
          await db.prepare(`UPDATE public_live SET live=0, ended_at=? WHERE id=1`).bind(now).run();
        }
        return cors(json({ ok: true }));
      }

      // Live destinations (upsert; key never read out in list responses)
      if (path === '/live/destinations' && request.method === 'POST') {
        const dests = Array.isArray(body.destinations) ? body.destinations : [];
        for (const d of dests) {
          if (!d || typeof d.id !== 'string') continue;
          await db.prepare(`INSERT INTO live_destinations (id,name,platform,server_url,key_hint) VALUES (?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name, platform=excluded.platform, server_url=excluded.server_url, key_hint=excluded.key_hint`)
            .bind(d.id, d.name || 'Channel', d.platform || 'custom', d.serverUrl || null, d.keyHint || '').run();
          if (typeof d.key === 'string' && d.key) {
            await db.prepare(`INSERT INTO live_keys (destination_id,key_value,updated_by,updated_at) VALUES (?,?,?,?)
              ON CONFLICT(destination_id) DO UPDATE SET key_value=excluded.key_value, updated_at=excluded.updated_at`)
              .bind(d.id, d.key, member.id, new Date().toISOString()).run();
          }
        }
        const list = await db.prepare('SELECT id,name,platform,server_url,key_hint FROM live_destinations ORDER BY name').all();
        return cors(json(list.results));
      }

      return cors(json({ error: 'not-found' }, 404));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || 'internal' }), { status: 500, headers: JSON_HEADERS });
    }
  }
};

// ---- helpers ----

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }

function publicMember(m) {
  if (!m) return null;
  return { id: m.id, name: m.name, email: m.email, role: m.role, accountStatus: m.account_status };
}

function norm(s) { return (typeof s === 'string' ? s : '').trim().toLowerCase(); }

function validEvent(b) {
  return b && typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && typeof b.en === 'string' && b.en.trim();
}

async function resolveSession(request, db) {
  const ah = request.headers.get(AUTH_HEADER_NAME) || '';
  const m = TOKEN_HEADER_RE.exec(ah);
  if (!m) return null;
  const hash = await sha256hex(m[1]);
  const s = await db.prepare('SELECT token_hash, member_id, expires_at FROM sessions WHERE token_hash = ?').bind(hash).first();
  if (!s || Date.parse(s.expires_at) < Date.now()) return null;
  return { token_hash: hash, member_id: s.member_id };
}

async function issueSession(db, memberId) {
  const token = btoa(await randomHex(32));
  const hash = await sha256hex(token);
  await db.prepare('INSERT INTO sessions (token_hash, member_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(hash, memberId, new Date().toISOString(), new Date(Date.now() + SESSION_TTL_MS).toISOString()).run();
  return token;
}

// PBKDF2-HMAC-SHA256 (WebCrypto) with a random salt, encoded "pbkdf2$iter$salt$hash"
async function hashPassword(password) {
  const iter = 210000;
  const salt = await randomHex(16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: iter }, key, 256);
  return `pbkdf2$${iter}$${salt}$${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const [alg, iterStr, salt, expect] = stored.split('$');
    if (alg !== 'pbkdf2') return false;
    const iter = Number(iterStr) || 210000;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: iter }, key, 256);
    return bytesToHex(new Uint8Array(bits)) === expect;
  } catch { return false; }
}

async function randomHex(bytes) { const a = crypto.getRandomValues(new Uint8Array(bytes)); return bytesToHex(a); }
async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return bytesToHex(new Uint8Array(d)); }
function bytesToHex(b) { return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(h) { return new Uint8Array((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16))); }
