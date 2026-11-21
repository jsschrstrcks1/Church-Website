// LOCAL verification of the Lakeview worker (prayer + live-flag + email) against an
// in-memory SQLite via a D1-compatible adapter. No Cloudflare account/wrangler needed.
// Usage: node test-local.mjs  (from worker/)
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import worker from './src/index.js';

const db = new DatabaseSync(':memory:');
db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));

const wrap = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    const make = (args) => ({
      all: () => ({ results: stmt.all(...args) }),
      first: () => stmt.get(...args) ?? null,
      run: () => { const info = stmt.run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; }
    });
    // D1 exposes .all()/.first()/.run() on the (possibly bound) statement.
    return Object.assign(make([]), { bind: (...args) => make(args) });
  }
};
const env = { DB: wrap, LIVE_FLAG_KEY: 'test-key' };

const results = [];
const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail: detail === undefined ? '' : JSON.stringify(detail).slice(0, 120) });
const sha256hex = async (s) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
};
// Sends a request and returns { json, status }
const call = async (method, path, body, headers = {}) => {
  const res = await worker.fetch(new Request('http://test' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  }), env, {});
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
};

// --- seed a staff member + session (token = 'staff-token') ---
const hash = await sha256hex('staff-token');
db.exec("INSERT INTO members (id,name,email,pass_hash,role,account_status,created_at) VALUES ('m1','Ada','ada@x','x','owner','active',datetime('now'))");
wrap.prepare("INSERT INTO sessions (token_hash,member_id,created_at,expires_at) VALUES (?, 'm1', datetime('now'), datetime('now','+1 day'))").bind(hash).run();

let r;
// --- public submit (opted into 'everyone') ---
r = await call('POST', '/prayer', { text: 'Please pray for our family.', visibility: 'everyone' });
check('public submit ok', r.status === 200 && r.data.ok === true, r.data);
// --- public list empty until approved ---
r = await call('GET', '/prayer');
check('public list hides pending', r.status === 200 && Array.isArray(r.data) && r.data.length === 0, r.data);
// --- live flag: wrong key 403, right key ok, status reflects it ---
r = await call('POST', '/live/flag', { live: true }, { 'x-live-key': 'wrong' });
check('live flag needs key', r.status === 403, r.status);
r = await call('POST', '/live/flag', { live: true }, { 'x-live-key': 'test-key' });
check('live flag with key ok', r.status === 200, r.status);
r = await call('GET', '/live/status');
check('live status live after flag', r.status === 200 && r.data.live === true, r.data);
// --- staff sees pending ---
r = await call('GET', '/prayer', null, { Authorization: 'Bearer staff-token' });
check('staff list sees pending', r.status === 200 && Array.isArray(r.data) && r.data.some((p) => p.status === 'pending'), r.status);
// --- approve ---
const id = (await call('GET', '/prayer', null, { Authorization: 'Bearer staff-token' })).data.find((p) => p.status === 'pending').id;
r = await call('POST', `/prayer/${id}/review`, { status: 'approved' }, { Authorization: 'Bearer staff-token' });
check('approve ok', r.status === 200, r.data);
// --- public now shows it ---
r = await call('GET', '/prayer');
check('approved everyone is public', r.status === 200 && Array.isArray(r.data) && r.data.length === 1, r.data);
// --- answered hides it again ---
r = await call('POST', `/prayer/${id}/answered`, { answered: true }, { Authorization: 'Bearer staff-token' });
check('answered ok', r.status === 200, r.data);
r = await call('GET', '/prayer');
check('answered hidden from public', r.status === 200 && Array.isArray(r.data) && r.data.length === 0, r.data);
// --- email intake -> pending prayer ---
const mkStream = (s) => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(s)); controller.close(); } });
await worker.email({ raw: mkStream('From: jane@example.com\n\nPlease pray for my daughter.'), from: { address: 'jane@example.com' } }, env);
r = await call('GET', '/prayer', null, { Authorization: 'Bearer staff-token' });
const emailPending = r.data.filter((p) => p.source === 'email' && p.status === 'pending');
check('email intake in queue', emailPending.length === 1, emailPending.map((p) => ({ s: p.source, st: p.status })));
// --- non-staff member sees only approved (not pending) ---
db.exec("INSERT INTO members (id,name,email,pass_hash,role,account_status,created_at) VALUES ('m2','Ben','ben@x','x','admin','active',datetime('now'))");
const hash2 = await sha256hex('member-token');
wrap.prepare("INSERT INTO sessions (token_hash,member_id,created_at,expires_at) VALUES (?, 'm2', datetime('now'), datetime('now','+1 day'))").bind(hash2).run();
await call('POST', `/prayer/${emailPending[0].id}/review`, { status: 'approved' }, { Authorization: 'Bearer staff-token' });
r = await call('GET', '/prayer', null, { Authorization: 'Bearer member-token' });
check('member sees only approved', r.status === 200 && r.data.every((p) => p.status === 'approved'), r.data.map((p) => p.status));

// --- sermon routes: create/publish/visibility/transcribe-guard ---
r = await call('POST', '/sermons', { title: 'Sermon: Grace', date: '2026-11-21', visibility: 'public', mediaKey: 'sermons/grace.mp4' }, { Authorization: 'Bearer staff-token' });
const sid = r.data?.id;
check('create sermon', r.status === 200 && !!sid, r.data);
// anonymous sees nothing until published + public
r = await call('GET', '/sermons');
check('anon sermon list hides unpublished', r.status === 200 && Array.isArray(r.data) && r.data.length === 0, r.data);
r = await call('POST', `/sermons/${sid}/publish`, { published: true }, { Authorization: 'Bearer staff-token' });
check('publish sermon', r.status === 200, r.status);
// member GET includes transcript fields (empty now) + visibility; anon does not
r = await call('GET', `/sermons/${sid}`, null, { Authorization: 'Bearer member-token' });
check('member sees sermon w/ transcript fields', r.status === 200 && r.data.vtt !== undefined, Object.keys(r.data));
r = await call('GET', `/sermons/${sid}`);
check('anon sees published public sermon', r.status === 200 && r.data.transcript === undefined, r.data);
// transcribe guard returns 501 without env.AI/env.SERMONS
r = await call('POST', `/sermons/${sid}/transcribe`, {}, { Authorization: 'Bearer staff-token' });
check('transcribe guarded (501 without bindings)', r.status === 501, r.data);

// logged-in members can opt to text the request to the church prayer line (queued until a sender is configured)
r = await call('POST', '/prayer', { text: 'Please text me back', visibility: 'members', submittedBy: 'Ben', viaSms: true }, { Authorization: 'Bearer member-token' });
check('member viaSms submit -> queued', r.status === 200 && r.data.smsDispatch === 'queued', r.data);
r = await call('POST', '/prayer', { text: 'x', visibility: 'members', viaSms: true });
check('anonymous viaSms ignored (none)', r.status === 200 && r.data.smsDispatch === 'none', r.data);

const pass = results.every((x) => x.ok);
console.log('\n=== results ===');
for (const x of results) console.log(`  [${x.ok ? 'PASS' : 'FAIL'}] ${x.name}${x.detail ? '  ' + x.detail : ''}`);
console.log(pass ? '\nALL PASS' : '\nSOME FAILED');
process.exit(pass ? 0 : 1);
