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
const STALE_LIVE_MS = 180 * 60 * 1000; // 3h — a flag flip holds for a whole service; site polls /live/status every 45s

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
      // Parse JSON body for all methods except GET (DELETE includes it).
      const body = request.headers.get('content-type')?.includes('application/json')
        ? await request.json().catch(() => ({}))
        : {};

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

      // Public invite lookup: returns only enough to show the welcome screen
      const invMatch = path.match(/^\/invites\/([\w]+)$/);
      if (invMatch && request.method === 'GET') {
        const iv = await db.prepare("SELECT name, email, role, expires_at FROM invites WHERE code = ? AND used_at IS NULL").bind(invMatch[1]).first();
        if (!iv) return cors(json({ error: 'invite-not-found' }, 404));
        if (iv.expires_at && Date.parse(iv.expires_at) < Date.now()) return cors(json({ error: 'invite-expired' }, 410));
        return cors(json({ name: iv.name, email: iv.email, role: iv.role }));
      }

      if (path === '/auth/accept-invite' && request.method === 'POST') {        const iv = await db.prepare("SELECT * FROM invites WHERE code = ? AND used_at IS NULL AND lower(email) = lower(?)")
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

      // ====== Public (no auth) content endpoints ======
      // Form response (visitors RSVP/submit), poll vote, share read, file serve.
      const formRespPost = path.match(/^\/forms\/([\w-]+)\/responses$/);
      if (formRespPost && request.method === 'POST') {
        const formId = formRespPost[1];
        await db.prepare('INSERT INTO form_responses (form_id, payload, respondent, created_at) VALUES (?,?,?,?)')
          .bind(formId, JSON.stringify(body.payload || {}), (body.respondent || '').toString(), new Date().toISOString()).run();
        return cors(json({ ok: true }));
      }
      if (path === '/rsvps' && request.method === 'POST') {
        const r = await db.prepare('INSERT INTO events_rsvps (event_id, newsletter_id, guest_name, guests, option, notes, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(body.eventId || null, body.newsletterId || null, body.guestName || '', Number(body.guests) || 1, body.option || '', body.notes || '', new Date().toISOString()).run();
        return cors(json({ id: r.meta.last_row_id }));
      }
      if (path === '/polls/vote' && request.method === 'POST') {
        await db.prepare('INSERT INTO poll_votes (poll_id, option_text, voter, created_at) VALUES (?,?,?,?)')
          .bind(body.pollId, body.optionText || '', body.voter || null, new Date().toISOString()).run();
        return cors(json({ ok: true }));
      }
      if (path === '/share/settings' && request.method === 'GET') {
        const row = await db.prepare('SELECT payload FROM share_settings WHERE id = 1').first();
        return cors(json(row ? JSON.parse(row.payload || '{}') : {}));
      }
      const fileGet = path.match(/^\/files\/([\w-]+)$/);
      if (fileGet && request.method === 'GET') {
        const row = await db.prepare('SELECT id, name, mime, data FROM files WHERE id = ?').bind(fileGet[1]).first();
        if (!row) return new Response('not found', { status: 404 });
        const bin = atob(row.data.replace(/^data:[^;]+;base64,/, ''));
        return new Response(new Uint8Array([...bin].map((c) => c.charCodeAt(0))), { headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000' } });
      }

      // ===== Prayer requests (public intake + public read) =====
      // Anyone can submit; requests land PENDING and need staff approval before showing.
      if (path === '/prayer' && request.method === 'POST') {
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text) return cors(json({ error: 'empty-prayer' }, 400));
        if (text.length > 4000) return cors(json({ error: 'too-long' }, 400));
        // Default to members-only (privacy): the submitter opts in to 'everyone'.
        const visibility = body.visibility === 'everyone' ? 'everyone' : 'members';
        const id = crypto.randomUUID();
        const submittedBy = typeof body.submittedBy === 'string' ? body.submittedBy.trim().slice(0, 120) : '';
        await db.prepare('INSERT INTO prayer_requests (id,text,visibility,status,submitted_by,source,created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(id, text, visibility, 'pending', submittedBy || null, 'app', new Date().toISOString()).run();
        // Logged-in members may also have the request texted to the church prayer line.
        // Provider-agnostic: dispatch to env.SMS_SENDER_URL if configured, else leave as a
        // normal pending request (sms_dispatch='queued' below is just informational).
        let smsDispatched = false;
        if (authed && body.viaSms === true) {
          await db.prepare('UPDATE prayer_requests SET via_sms=1, sms_to=? WHERE id=?').bind((env.PRAYER_PHONE || '').slice(0, 30), id).run();
          if (env.SMS_SENDER_URL) {
            try {
              const headers = { 'Content-Type': 'application/json' };
              if (env.SMS_SENDER_TOKEN) headers['Authorization'] = `Bearer ${env.SMS_SENDER_TOKEN}`;
              const r = await fetch(env.SMS_SENDER_URL, {
                method: 'POST', headers,
                body: JSON.stringify({ to: env.PRAYER_PHONE || '', text, member: submittedBy || null }),
                signal: AbortSignal.timeout(8000)
              });
              smsDispatched = r.ok;
              if (!r.ok) console.log('SMS dispatch failed:', r.status);
            } catch (e) { console.log('SMS dispatch error:', e.message); }
          }
        }
        return cors(json({ ok: true, id, smsDispatch: authed && body.viaSms === true ? (smsDispatched ? 'sent' : env.SMS_SENDER_URL ? 'failed' : 'queued') : 'none' }));
      }
      // Prayer reads: anonymous visitors see only approved + opted-in 'everyone'; logged-in
      // members see approved (all visibilities); staff see everything (pending/approved/denied).
      if (path === '/prayer' && request.method === 'GET') {
        const isStaff = authed && (member.role === 'owner' || member.role === 'admin');
        const rows = isStaff
          ? await db.prepare("SELECT id,text,visibility,status,answered,submitted_by,source,created_at,approved_at FROM prayer_requests ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC LIMIT 500").all()
          : authed
            ? await db.prepare("SELECT id,text,visibility,status,answered,created_at FROM prayer_requests WHERE status='approved' ORDER BY created_at DESC LIMIT 200").all()
            : await db.prepare("SELECT id,text,created_at FROM prayer_requests WHERE status='approved' AND visibility='everyone' AND answered=0 ORDER BY created_at DESC LIMIT 100").all();
        return cors(json(rows.results));
      }

      // ---- Sermons (archive + transcripts) ----
      // Anonymous: published + public-visibility only, no transcript. Members: published
      // (any visibility) incl. transcript + read-along VTT. Staff: everything.
      if (path === '/sermons' && request.method === 'GET') {
        const isStaff = authed && (member.role === 'owner' || member.role === 'admin');
        let rows;
        if (isStaff) rows = await db.prepare('SELECT id,title,date,mode,description,published,visibility,transcript_updated_at FROM sermons ORDER BY date DESC LIMIT 300').all();
        else if (authed) rows = await db.prepare("SELECT id,title,date,mode,description,published,visibility,transcript_updated_at FROM sermons WHERE published=1 ORDER BY date DESC LIMIT 200").all();
        else rows = await db.prepare("SELECT id,title,date,mode,description FROM sermons WHERE published=1 AND visibility='public' ORDER BY date DESC LIMIT 100").all();
        return cors(json(rows.results));
      }
      const sermonGet = path.match(/^\/sermons\/([\w-]+)$/);
      if (sermonGet && request.method === 'GET') {
        const isStaff = authed && (member.role === 'owner' || member.role === 'admin');
        const row = await db.prepare('SELECT * FROM sermons WHERE id=?').bind(sermonGet[1]).first();
        if (!row) return cors(json({ error: 'not-found' }, 404));
        const visible = isStaff || (authed ? row.published === 1 : (row.published === 1 && row.visibility === 'public'));
        if (!visible) return cors(json({ error: 'not-found' }, 404));
        const out = { id: row.id, title: row.title, date: row.date, mode: row.mode, description: row.description, published: !!row.published, visibility: row.visibility, media_key: row.media_key || null };
        if (authed || isStaff) { out.transcript = row.transcript; out.vtt = row.transcript_vtt; }
        return cors(json(out));
      }

      // Serve a sermon's video by byte range. A <video> tag can't send a header, so
      // members-only playback passes the session token as ?t= (checked against D1).
      const sermonMedia = path.match(/^\/sermons\/([\w-]+)\/media$/);
      if (sermonMedia && request.method === 'GET') {
        const mrow = await db.prepare('SELECT media_key,title,visibility,published FROM sermons WHERE id=?').bind(sermonMedia[1]).first();
        const staff = authed && (member.role === 'owner' || member.role === 'admin');
        let viewerAuthed = authed;
        if (!viewerAuthed) {
          const t = new URL(request.url).searchParams.get('t');
          if (t) {
            const s = await sessionFromToken(db, t);
            if (s) viewerAuthed = !!(await db.prepare("SELECT 1 FROM members WHERE id=? AND account_status='active'").bind(s.member_id).first());
          }
        }
        if (!mrow || !mrow.media_key) return cors(json({ error: 'no-media' }, 404));
        const visible = staff || (mrow.published === 1 && (mrow.visibility === 'public' || viewerAuthed));
        if (!visible) return cors(json({ error: 'forbidden' }, 403));
        if (!env.SERMONS) return cors(json({ error: 'media-not-configured' }, 501));
        const obj = await env.SERMONS.get(mrow.media_key);
        if (!obj) return cors(json({ error: 'media-missing' }, 404));
        const size = Number(obj.size) || 0;
        const public_ = mrow.visibility === 'public';
        const V = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': public_ ? 'public, max-age=600' : 'private, no-store' };
        const range = request.headers.get('range');
        if (range) {
          const rm = /bytes=(\d*)-(\d*)/.exec(range);
          let start = rm && rm[1] !== '' ? parseInt(rm[1], 10) : 0;
          let end = rm && rm[2] !== '' ? parseInt(rm[2], 10) : size - 1;
          if (!Number.isFinite(start) || start < 0) start = 0;
          if (!Number.isFinite(end) || end >= size) end = size - 1;
          if (start > end || size === 0) return new Response('', { status: 416, headers: { ...V, 'Content-Range': `bytes */${size}` } });
          const part = await env.SERMONS.get(mrow.media_key, { range: { offset: start, length: end - start + 1 } });
          return new Response(part.body, { status: 206, headers: { ...V, 'Content-Range': `bytes ${start}-${end}/${size}` } });
        }
        return new Response(obj.body, { status: 200, headers: V });
      }
      // Staff upload a sermon video: raw bytes → R2 (mp4), record the key on the row.
      // (Workers body limit ≈100 MB; larger clips need the presigned multipart path — see roadmap.)
      if (sermonMedia && request.method === 'PUT') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        if (!env.SERMONS) return cors(json({ error: 'media-not-configured' }, 501));
        const buf = await request.arrayBuffer();
        if (!buf || buf.byteLength < 1000) return cors(json({ error: 'empty-body' }, 400));
        const key = `sermons/${sermonMedia[1]}.mp4`;
        await env.SERMONS.put(key, buf, { httpMetadata: { contentType: 'video/mp4' } });
        await db.prepare('UPDATE sermons SET media_key=? WHERE id=?').bind(key, sermonMedia[1]).run();
        return cors(json({ ok: true, mediaKey: key, bytes: buf.byteLength }));
      }

      // Local Studio flips the public "live" flag on GO LIVE / Stop, using a shared secret
      // instead of a member session (replaces obsctl; the console isn't a member client).
      if (path === '/live/flag' && request.method === 'POST') {
        if (!env.LIVE_FLAG_KEY || request.headers.get('x-live-key') !== env.LIVE_FLAG_KEY) {
          return cors(json({ error: 'forbidden' }, 403));
        }
        const now = new Date().toISOString();
        if (body.live === true) {
          await db.prepare("UPDATE live_state SET status='live', heartbeat_at=? WHERE id=1").bind(now).run();
          await db.prepare('UPDATE public_live SET live=1, heartbeat_at=? WHERE id=1').bind(now).run();
        } else {
          await db.prepare("UPDATE live_state SET status='idle', ended_at=? WHERE id=1").bind(now).run();
          await db.prepare('UPDATE public_live SET live=0, ended_at=? WHERE id=1').bind(now).run();
        }
        return cors(json({ ok: true }));
      }

      if (!authed) return cors(json({ error: 'unauthorized' }, 401));

      // Logout
      if (path === '/auth/logout' && request.method === 'POST') {
        await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.token_hash).run();
        return cors(json({ ok: true }));
      }

      // Me
      if (path === '/auth/me' && request.method === 'GET') return cors(json({ member: publicMember(member) }));

      // Profile: update name
      if (path === '/auth/profile' && request.method === 'POST') {
        if (typeof body.name === 'string' && body.name.trim()) {
          await db.prepare('UPDATE members SET name = ? WHERE id = ?').bind(body.name.trim(), member.id).run();
        }
        return cors(json({ member: publicMember(await db.prepare('SELECT * FROM members WHERE id = ?').bind(member.id).first()) }));
      }

      // Profile: change password (verifies current password first)
      if (path === '/auth/password' && request.method === 'POST') {
        const row = await db.prepare('SELECT * FROM members WHERE id = ?').bind(member.id).first();
        if (!row || typeof body.current !== 'string' || !(await verifyPassword(body.current, row.pass_hash))) {
          return cors(json({ error: 'wrong-current-password' }, 400));
        }
        if (typeof body.next !== 'string' || body.next.length < 8) return cors(json({ error: 'password-too-short' }, 400));
        await db.prepare('UPDATE members SET pass_hash = ? WHERE id = ?').bind(await hashPassword(body.next), member.id).run();
        return cors(json({ ok: true }));
      }


      // ===== Prayer requests (member read + staff moderation) =====
      // (List read is handled above for all three roles.)
      const pray = path.match(/^\/prayer\/([\w-]+)$/);
      if (pray && request.method === 'DELETE') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        await db.prepare('DELETE FROM prayer_requests WHERE id = ?').bind(pray[1]).run();
        return cors(json({ ok: true }));
      }
      const prayReview = path.match(/^\/prayer\/([\w-]+)\/review$/);
      if (prayReview && request.method === 'POST') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        const status = body.status === 'approved' ? 'approved' : body.status === 'denied' ? 'denied' : null;
        if (!status) return cors(json({ error: 'invalid-status' }, 400));
        const now = new Date().toISOString();
        await db.prepare('UPDATE prayer_requests SET status=?, reviewed_by=?, answered=?, approved_at=?, reviewed_at=? WHERE id=?')
          .bind(status, member.id, body.answered === true ? 1 : 0, status === 'approved' ? now : null, now, prayReview[1]).run();
        return cors(json({ ok: true }));
      }
      const prayAnswer = path.match(/^\/prayer\/([\w-]+)\/answered$/);
      if (prayAnswer && request.method === 'POST') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        await db.prepare('UPDATE prayer_requests SET answered=? WHERE id=?').bind(body.answered === true ? 1 : 0, prayAnswer[1]).run();
        return cors(json({ ok: true }));
      }

      // ===== Sermons admin (create, publish, transcribe via Workers AI Whisper) =====
      if (path === '/sermons' && request.method === 'POST') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
        const id = crypto.randomUUID();
        await db.prepare('INSERT INTO sermons (id,title,date,mode,description,visibility,published,media_key,created_at,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(id, (body.title || '').slice(0, 200), date, body.mode === 'sunday' ? 'sunday' : 'wednesday',
            (body.description || '').slice(0, 500), body.visibility === 'public' ? 'public' : 'members',
            body.published === true ? 1 : 0, typeof body.mediaKey === 'string' ? body.mediaKey.slice(0, 300) : null,
            new Date().toISOString(), member.id).run();
        return cors(json({ id }));
      }
      const sermonPublish = path.match(/^\/sermons\/([\w-]+)\/publish$/);
      if (sermonPublish && request.method === 'POST') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        await db.prepare('UPDATE sermons SET published=?, published_at=? WHERE id=?').bind(body.published === true ? 1 : 0, new Date().toISOString(), sermonPublish[1]).run();
        return cors(json({ ok: true }));
      }
      // Transcribe a sermon clip (Workers AI Whisper). Needs env.AI + env.SERMONS (R2).
      const sermonX = path.match(/^\/sermons\/([\w-]+)\/transcribe$/);
      if (sermonX && request.method === 'POST') {
        if (!(member.role === 'owner' || member.role === 'admin')) return cors(json({ error: 'forbidden' }, 403));
        const row = await db.prepare('SELECT * FROM sermons WHERE id=?').bind(sermonX[1]).first();
        if (!row || !row.media_key) return cors(json({ error: 'no-media' }, 400));
        if (!env.AI || !env.SERMONS) return cors(json({ error: 'transcription-not-configured' }, 501));
        const obj = await env.SERMONS.get(row.media_key);
        if (!obj) return cors(json({ error: 'media-missing' }, 404));
        const audio = await obj.arrayBuffer();
        const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio });
        const transcript = String(out?.text || out?.output_text || '').trim();
        const words = Array.isArray(out?.words) ? out.words : [];
        const vtt = wordsToVtt(words, transcript);
        const description = body.description !== undefined ? String(body.description).slice(0, 500) : transcript.slice(0, 220);
        await db.prepare('UPDATE sermons SET transcript=?, transcript_vtt=?, description=?, transcript_updated_at=? WHERE id=?')
          .bind(transcript, vtt, description, new Date().toISOString(), row.id).run();
        return cors(json({ ok: true, words: words.length, vttChars: vtt.length }));
      }

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
        const name = (body.name || body.email.split('@')[0]).trim();
        const ttl = Number.isFinite(body.days) ? Math.min(90, Math.max(1, body.days)) : 14;
        const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare('INSERT INTO invites (code, name, email, role, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?)')
          .bind(code, name, norm(body.email), body.role === 'owner' ? 'owner' : 'admin', member.id, new Date().toISOString(), expiresAt).run();
        return cors(json({ code, name, email: norm(body.email), role: body.role === 'owner' ? 'owner' : 'admin', createdAt: new Date().toISOString(), expiresAt }));
      }
      if (path === '/members/invites' && request.method === 'GET') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        const rows = await db.prepare("SELECT code AS id, name, email, role, created_at, expires_at AS expiresAt FROM invites WHERE used_at IS NULL ORDER BY created_at DESC").all();
        return cors(json(rows.results));
      }
      if (path === '/members/invites' && request.method === 'DELETE') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        if (typeof body.code !== 'string') return cors(json({ error: 'invalid-invite' }, 400));
        await db.prepare('DELETE FROM invites WHERE code = ?').bind(body.code).run();
        return cors(json({ ok: true }));
      }
      if (path === '/members/role' && request.method === 'POST') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        if (!body.id) return cors(json({ error: 'invalid-member' }, 400));
        const target = await db.prepare("SELECT * FROM members WHERE id = ? AND account_status != 'removed'").bind(body.id).first();
        if (!target) return cors(json({ error: 'not-found' }, 404));
        if (body.role === 'owner') {
          const owners = await db.prepare("SELECT COUNT(*) AS n FROM members WHERE role = 'owner' AND account_status = 'active'").first();
          if (owners.n <= 1) return cors(json({ error: 'last-owner' }, 400));
        }
        const role = body.role === 'owner' ? 'owner' : 'admin';
        await db.prepare('UPDATE members SET role = ? WHERE id = ?').bind(role, body.id).run();
        return cors(json({ ok: true }));
      }
      if (path === '/members/remove' && request.method === 'POST') {
        if (!isOwner) return cors(json({ error: 'forbidden' }, 403));
        if (!body.id || body.id === member.id) return cors(json({ error: 'cannot-remove-self' }, 400));
        if (body.restore === true) {
          await db.prepare("UPDATE members SET account_status = 'active' WHERE id = ?").bind(body.id).run();
        } else {
          await db.prepare("UPDATE members SET account_status = 'removed' WHERE id = ?").bind(body.id).run();
          await db.prepare('DELETE FROM sessions WHERE member_id = ?').bind(body.id).run();
        }
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

      // ================= Content: newsletters =================
      if (path === '/newsletters' && request.method === 'GET') {
        // Only non-archived (list) — the UI separates retired ones; pass ?all=1 for those.
        const clause = url.searchParams.get('all') === '1' ? '' : "WHERE status = 'active'";
        const rows = await db.prepare(`SELECT id,name,title,status,published,is_primary AS isPrimary,is_publicly_listed AS isPubliclyListed,view_count AS viewCount,created_at,last_modified FROM newsletters ${clause} ORDER BY is_primary DESC, last_modified DESC`).all();
        return cors(json(rows.results));
      }
      if (path === '/newsletters' && request.method === 'POST') {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.prepare(`INSERT INTO newsletters (id,name,title,status,published,is_publicly_listed,view_count,content,theme,created_by,created_at,last_modified)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, (body.name || body.title || 'Untitled').trim(), body.title || '', 'active', 0, 1, 0,
            JSON.stringify(body.content || {}), JSON.stringify(body.theme || {}), member.id, now, now).run();
        return cors(json({ id }));
      }
      const nlMatch = path.match(/^\/newsletters\/([\w-]+)$/);
      if (nlMatch && request.method === 'GET') {
        const row = await db.prepare('SELECT * FROM newsletters WHERE id = ?').bind(nlMatch[1]).first();
        if (!row) return cors(json({ error: 'not-found' }, 404));
        return cors(json(mapNewsletter(row)));
      }
      if (nlMatch && request.method === 'PUT') {
        const now = new Date().toISOString();
        if (body.content !== undefined) { const c = JSON.stringify(restoreNewsletterContent(body)); await db.prepare('UPDATE newsletters SET content = ? WHERE id = ?').bind(c, nlMatch[1]).run(); await db.prepare('INSERT INTO newsletter_revisions (newsletter_id, content, saved_at, saved_by) VALUES (?,?,?,?)').bind(nlMatch[1], c, now, member.id).run(); }
        if (body.name !== undefined) await db.prepare('UPDATE newsletters SET name = ? WHERE id = ?').bind((body.name || '').trim(), nlMatch[1]).run();
        if (body.title !== undefined) await db.prepare('UPDATE newsletters SET title = ? WHERE id = ?').bind((body.title || '').trim(), nlMatch[1]).run();
        if (body.isPubliclyListed !== undefined) await db.prepare('UPDATE newsletters SET is_publicly_listed = ? WHERE id = ?').bind(body.isPubliclyListed ? 1 : 0, nlMatch[1]).run();
        await db.prepare('UPDATE newsletters SET last_modified = ? WHERE id = ?').bind(now, nlMatch[1]).run();
        return cors(json({ ok: true }));
      }
      if (nlMatch && request.method === 'DELETE') {
        // Delete dependents before the parent (FK constraint).
        const forms = await db.prepare('SELECT id FROM forms WHERE newsletter_id = ?').bind(nlMatch[1]).all();
        for (const f of forms.results) {
          await db.prepare('DELETE FROM form_responses WHERE form_id = ?').bind(f.id).run();
          await db.prepare('DELETE FROM poll_votes WHERE poll_id = ?').bind(f.id).run();
        }
        await db.prepare('DELETE FROM forms WHERE newsletter_id = ?').bind(nlMatch[1]).run();
        await db.prepare('DELETE FROM events_rsvps WHERE newsletter_id = ?').bind(nlMatch[1]).run();
        await db.prepare('DELETE FROM newsletter_revisions WHERE newsletter_id = ?').bind(nlMatch[1]).run();
        await db.prepare('DELETE FROM newsletter_public WHERE newsletter_id = ?').bind(nlMatch[1]).run();
        await db.prepare('DELETE FROM newsletters WHERE id = ?').bind(nlMatch[1]).run();
        return cors(json({ ok: true }));
      }
      // archive/reactivate (status) + publish + toggle — /newsletters/:id/action
      const nlAct = path.match(/^\/newsletters\/([\w-]+)\/(archive|reactivate|publish|unpublish|toggle-list)$/);
      if (nlAct && request.method === 'POST') {
        const [, id, action] = nlAct;
        const now = new Date().toISOString();
        if (action === 'archive') await db.prepare("UPDATE newsletters SET status='archived', published=0, last_modified=? WHERE id=?").bind(now, id).run();
        else if (action === 'reactivate') await db.prepare("UPDATE newsletters SET status='active', last_modified=? WHERE id=?").bind(now, id).run();
        else if (action === 'publish') {
          const row = await db.prepare('SELECT * FROM newsletters WHERE id = ?').bind(id).first();
          if (!row) return cors(json({ error: 'not-found' }, 404));
          const slug = (body.slug || row.title || row.name || 'newsletter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
          const html = renderNewsletterHtml(row.content);
          await db.prepare(`INSERT INTO newsletter_public (newsletter_id, slug, title, content_html, published_at) VALUES (?,?,?,?,?)
            ON CONFLICT(newsletter_id) DO UPDATE SET slug=excluded.slug, title=excluded.title, content_html=excluded.content_html, published_at=excluded.published_at`)
            .bind(id, slug || `nl-${id.slice(0, 8)}`, row.title || row.name, html, now).run();
          await db.prepare("UPDATE newsletters SET published=1, published_at=?, last_modified=? WHERE id=?").bind(now, now, id).run();
          return cors(json({ ok: true, slug }));
        }
        else if (action === 'unpublish') {
          await db.prepare("UPDATE newsletters SET published=0, published_at=NULL, last_modified=? WHERE id=?").bind(now, id).run();
          await db.prepare('DELETE FROM newsletter_public WHERE newsletter_id = ?').bind(id).run();
          return cors(json({ ok: true }));
        }
        else if (action === 'toggle-list') {
          const row = await db.prepare('SELECT is_publicly_listed FROM newsletters WHERE id = ?').bind(id).first();
          await db.prepare('UPDATE newsletters SET is_publicly_listed = ?, last_modified = ? WHERE id = ?').bind(row?.is_publicly_listed ? 0 : 1, now, id).run();
        }
        return cors(json({ ok: true }));
      }

      // ================= Content: forms / responses =================
      if (path === '/forms' && request.method === 'POST') {
        const id = crypto.randomUUID();
        await db.prepare('INSERT INTO forms (id, newsletter_id, title, schema, settings, created_at) VALUES (?,?,?,?,?,?)')
          .bind(id, body.newsletterId || null, body.title || 'Form', JSON.stringify(body.schema || {}), JSON.stringify(body.settings || {}), new Date().toISOString()).run();
        return cors(json({ id }));
      }
      const formRespGet = path.match(/^\/forms\/([\w-]+)\/responses$/);
      if (formRespGet && request.method === 'GET') {
        const rows = await db.prepare('SELECT id, form_id AS formId, payload, respondent, reviewed, created_at FROM form_responses WHERE form_id = ? ORDER BY created_at DESC').bind(formRespGet[1]).all();
        return cors(json(rows.results.map((r) => ({ ...r, payload: JSON.parse(r.payload || '{}'), reviewed: !!r.reviewed }))));
      }
      // toggle the reviewed flag on one response — /forms/:id/responses/:rid/review
      const respToggle = path.match(/^\/forms\/([\w-]+)\/responses\/(\d+)\/review$/);
      if (respToggle && request.method === 'POST') {
        const [, formId, rid ] = respToggle;
        await db.prepare('UPDATE form_responses SET reviewed = CASE WHEN reviewed=1 THEN 0 ELSE 1 END WHERE id=? AND form_id=?').bind(Number(rid), formId).run();
        const row = await db.prepare('SELECT reviewed FROM form_responses WHERE id=? AND form_id=?').bind(Number(rid), formId).first();
        return cors(json({ ok: true, reviewed: !!row?.reviewed }));
      }
      // delete a single response — /forms/:id/responses/:rid
      const respDel = path.match(/^\/forms\/([\w-]+)\/responses\/(\d+)$/);
      if (respDel && request.method === 'DELETE') {
        await db.prepare('DELETE FROM form_responses WHERE id=? AND form_id=?').bind(Number(respDel[2]), respDel[1]).run();
        return cors(json({ ok: true }));
      }
      // delete a whole form (and its responses) — /forms/:id
      const formDel = path.match(/^\/forms\/([\w-]+)$/);
      if (formDel && request.method === 'DELETE') {
        await db.prepare('DELETE FROM form_responses WHERE form_id=?').bind(formDel[1]).run();
        await db.prepare('DELETE FROM forms WHERE id=?').bind(formDel[1]).run();
        return cors(json({ ok: true }));
      }

      // ================= Content: RSVPs + polls =================
      // Authed RSVP read-back: ?newsletterId= or ?eventId=
      // (The public rsvp POST above the auth gate earlier in this handler is the live one.)
      if (path === '/rsvps' && request.method === 'GET') {
        const byNl = url.searchParams.get('newsletterId');
        const byEv = url.searchParams.get('eventId');
        const cols = 'id, event_id AS eventId, newsletter_id AS newsletterId, guest_name AS guestName, guests, option, notes, created_at';
        const rows = byNl
          ? await db.prepare(`SELECT ${cols} FROM events_rsvps WHERE newsletter_id = ? ORDER BY created_at DESC`).bind(byNl).all()
          : byEv
            ? await db.prepare(`SELECT ${cols} FROM events_rsvps WHERE event_id = ? ORDER BY created_at DESC`).bind(String(byEv)).all()
            : await db.prepare(`SELECT ${cols} FROM events_rsvps ORDER BY created_at DESC`).all();
        return cors(json(rows.results));
      }
      if (path === '/polls/vote' && request.method === 'POST') {
        await db.prepare('INSERT INTO poll_votes (poll_id, option_text, voter, created_at) VALUES (?,?,?,?)')
          .bind(body.pollId, body.optionText || '', body.voter || null, new Date().toISOString()).run();
        return cors(json({ ok: true }));
      }
      const pollTally = path.match(/^\/polls\/([\w-]+)\/votes$/);
      if (pollTally && request.method === 'GET') {
        const rows = await db.prepare('SELECT option_text, COUNT(*) AS votes FROM poll_votes WHERE poll_id = ? GROUP BY option_text').bind(pollTally[1]).all();
        return cors(json(rows.results));
      }

      // ================= Share customization =================
      if (path === '/share/settings' && request.method === 'GET') {
        const row = await db.prepare('SELECT payload FROM share_settings WHERE id = 1').first();
        return cors(json(row ? JSON.parse(row.payload || '{}') : {}));
      }
      if (path === '/share/settings' && request.method === 'PUT') {
        await db.prepare('UPDATE share_settings SET payload = ? WHERE id = 1').bind(JSON.stringify(body || {})).run();
        return cors(json({ ok: true }));
      }

      // ================= Files (image uploads, replaces Storage) =================
      if (path === '/files' && request.method === 'POST') {
        const id = crypto.randomUUID();
        const data = body.data || '';
        const mime = typeof body.mime === 'string' ? body.mime : 'application/octet-stream';
        const buf = atob(data.replace(/^data:[^;]+;base64,/, ''));
        await db.prepare('INSERT INTO files (id, name, mime, size, data, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(id, (body.name || 'file').slice(0, 200), mime, buf.length, data, member.id, new Date().toISOString()).run();
        return cors(json({ id }));
      }
      const fileMatch = path.match(/^\/files\/([\w-]+)$/);
      if (fileMatch && request.method === 'GET') {
        const row = await db.prepare('SELECT id, name, mime, data FROM files WHERE id = ?').bind(fileMatch[1]).first();
        if (!row) return new Response('not found', { status: 404 });
        const bin = atob(row.data.replace(/^data:[^;]+;base64,/, ''));
        return new Response(new Uint8Array([...bin].map((c) => c.charCodeAt(0))), { headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000' } });
      }
      if (fileMatch && request.method === 'DELETE') {
        await db.prepare('DELETE FROM files WHERE id = ?').bind(fileMatch[1]).run();
        return cors(json({ ok: true }));
      }

      return cors(json({ error: 'not-found' }, 404));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || 'internal' }), { status: 500, headers: JSON_HEADERS });
    }
  },

  // Cloudflare Email Routing -> this Worker (prayers@lakeviewfellowshipchurch.com).
  // An inbound email is turned into a PENDING prayer request (default members-only) so it
  // lands in the same staff-approval queue as app submissions. Best effort: a malformed
  // email must not break routing.
  async email(message, env) {
    try {
      const db = env.DB;
      let raw = '';
      const stream = message.raw || message.text;
      if (stream && typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += new TextDecoder().decode(value);
          if (raw.length > 65536) break;
        }
      }
      // Crude text extraction: drop headers/signature/replies and HTML tags.
      const body = raw.replace(/^[^\r\n]*\r?\n(?:\r?\n)+/s, '') // first line + blank line = SMTP preamble
        .replace(/\r?\n>.*$/s, '').replace(/^(-+\s*)+$/gm, '')   // quoted replies + sig dashes
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      const text = body.slice(0, 4000);
      if (!text) return;
      const from = typeof message.from === 'string' ? message.from : (message.from?.address || '');
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO prayer_requests (id,text,visibility,status,submitted_by,source,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(id, text, 'members', 'pending', from || null, 'email', new Date().toISOString()).run();
    } catch { /* ignore; routing shouldn't fail on a bad email */ }
  }
};

// ---- helpers ----

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }

function publicMember(m) {
  if (!m) return null;
  return { id: m.id, name: m.name, email: m.email, role: m.role, accountStatus: m.account_status };
}

function norm(s) { return (typeof s === 'string' ? s : '').trim().toLowerCase(); }

// Simple renderer: turns editor JSON (ops/blocks {type,text}) into safe HTML for the public view.
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderNewsletterHtml(content) {
  let out = '';
  let data = content;
  try { data = typeof content === 'string' ? JSON.parse(content) : content; } catch { data = content; }
  const blocks = Array.isArray(data) ? data
    : (data && Array.isArray(data.ops)) ? data.ops
    : (data && Array.isArray(data.blocks)) ? data.blocks : [];
  for (const b of blocks) {
    const text = b.insert ?? b.text ?? (typeof b === 'string' ? b : '');
    if (b.insert === '\n' || b.insert === undefined && text === '\n') continue;
    const t = esc(text);
    const attrs = b.attributes || {};
    let inner = t;
    if (attrs.bold) inner = `<strong>${inner}</strong>`;
    if (attrs.italic) inner = `<em>${inner}</em>`;
    if (b.type === 'heading' || b.header) out += `<h3 style="margin:.5em 0">${inner}</h3>\n`;
    else out += `<p style="margin:.35em 0">${inner}</p>\n`;
  }
  return out;
}

// Row (snake_case) -> camelCase object matching what the UI expects.
function mapNewsletter(row) {
  if (!row) return row;
  const { status, published, is_primary, is_publicly_listed, view_count, last_modified, ...rest } = row;
  return {
    ...rest,
    status,
    published: !!published,
    isPrimary: !!is_primary,
    isPubliclyListed: !!is_publicly_listed,
    viewCount: view_count,
    lastModified: last_modified,
    content: (() => { try { return row.content === undefined ? undefined : JSON.parse(row.content || '{}'); } catch { return {}; } })(),
    theme: (() => { try { return JSON.parse(row.theme || '{}'); } catch { return {}; } })()
  };
}

// The UI sends the whole newsletter as `content`; the editor stores named fields directly.
// Flatten the DEFAULT_NEWSLETTER_CONTENT shape (title/subtitle/sections/colors/...) into content JSON.
function restoreNewsletterContent(body) {
  return body.content;
}

function validEvent(b) {
  return b && typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && typeof b.en === 'string' && b.en.trim();
}

// Build a WebVTT transcript from Whisper word timing (fallback: one cue for the whole text).
function wordsToVtt(words, text) {
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const ts = (s) => { const ms = Math.round((Number(s) || 0) * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const sec = Math.floor((ms % 60000) / 1000); const mm = ms % 1000; return `${pad(h)}:${pad(m)}:${pad(sec)}.${String(mm).padStart(3, '0')}`; };
  let out = 'WEBVTT\n\n';
  if (!Array.isArray(words) || words.length === 0) {
    if (text) out += `00:00:00.000 --> 99:00:00.000\n${text.replace(/\n/g, ' ')}\n\n`;
    return out;
  }
  let line = [];
  let lineStart = 0;
  let lineEnd = 0;
  let count = 0;
  for (const w of words) {
    const word = typeof w === 'string' ? w : (typeof w?.word === 'string' ? w.word : '');
    if (!word) continue;
    if (line.length === 0) lineStart = Number(w?.start) || lineStart;
    if (Number.isFinite(Number(w?.end))) lineEnd = Number(w.end);
    line.push(word);
    count += 1;
    if (count >= 8 || line.join(' ').length > 70) {
      out += `${ts(lineStart)} --> ${ts(lineEnd)}\n${line.join(' ')}\n\n`;
      line = [];
      count = 0;
    }
  }
  if (line.length) out += `${ts(lineStart)} --> ${ts(lineEnd)}\n${line.join(' ')}\n\n`;
  return out;
}

async function sessionFromToken(db, token) {
  if (!token || typeof token !== 'string') return null;
  const hash = await sha256hex(token);
  const s = await db.prepare('SELECT token_hash, member_id, expires_at FROM sessions WHERE token_hash = ?').bind(hash).first();
  if (!s || Date.parse(s.expires_at) < Date.now()) return null;
  return { token_hash: hash, member_id: s.member_id };
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
// NOTE: Cloudflare's workerd caps PBKDF2 iterations at 100,000 (runtime refuses more),
// well below Node's 2,147,483,647. Keep iterations <= 100000 or auth dies in production.
async function hashPassword(password) {
  const iter = 100000;
  const salt = await randomHex(16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: iter }, key, 256);
  return `pbkdf2$${iter}$${salt}$${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const [alg, iterStr, salt, expect] = stored.split('$');
    if (alg !== 'pbkdf2') return false;
    const iter = Math.min(Number(iterStr) || 100000, 100000);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: iter }, key, 256);
    return bytesToHex(new Uint8Array(bits)) === expect;
  } catch { return false; }
}

async function randomHex(bytes) { const a = crypto.getRandomValues(new Uint8Array(bytes)); return bytesToHex(a); }
async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return bytesToHex(new Uint8Array(d)); }
function bytesToHex(b) { return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(h) { return new Uint8Array((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16))); }
