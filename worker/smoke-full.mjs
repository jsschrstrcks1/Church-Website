// Full backend smoke test: bootstrap owner -> login -> invite -> accept -> events -> live -> guards.
const BASE = 'http://127.0.0.1:8787';
const j = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
};
const results = [];
const check = (n, c, d) => results.push({ name: n, ok: !!c, detail: d });

// 1. bootstrap first owner
let r = await j('POST', '/auth/bootstrap', { key: 'test-bootstrap-key-abc', email: 'owner@lakeview.org', password: 'password123', name: 'Ken Owner' });
check('bootstrap owner', r.status === 200 && !!r.data?.token && r.data.member?.role === 'owner', r);
const ownerTok = r.data?.token;

// 2. bootstrap refused twice
r = await j('POST', '/auth/bootstrap', { key: 'test-bootstrap-key-abc', email: 'x@x.com', password: 'password123' });
check('bootstrap once-only', r.status === 400, r);

// 3. login works
r = await j('POST', '/auth/login', { email: 'owner@lakeview.org', password: 'password123' });
check('owner login', r.status === 200 && !!r.data?.token, r);
const tok2 = r.data?.token;

// 4. login wrong password
r = await j('POST', '/auth/login', { email: 'owner@lakeview.org', password: 'wrong' });
check('login rejects bad pw', r.status === 401, r);

// 5. me
r = await j('GET', '/auth/me', null, tok2);
check('me', r.status === 200 && r.data.member?.name === 'Ken Owner', r);

// 6. create invite for a member
r = await j('POST', '/members/invite', { email: 'deacon@lakeview.org', role: 'admin' }, tok2);
check('owner creates invite', r.status === 200 && !!r.data?.code, r);
const code = r.data?.code;

// 7. member accepts invite
r = await j('POST', '/auth/accept-invite', { code, email: 'deacon@lakeview.org', password: 'memberpass' });
check('member accepts invite', r.status === 200 && !!r.data?.token && r.data.member?.role === 'admin', r);
const memberTok = r.data?.token;

// 8. member lists members? (should be forbidden, owner only)
r = await j('GET', '/members', null, memberTok);
check('member cannot list (forbidden)', r.status === 403, r);
r = await j('GET', '/members', null, tok2);
check('owner lists members', r.status === 200 && r.data.length >= 2, r);

// 9. events: add as member, read as public, edit, delete
r = await j('POST', '/events', { date: '2026-12-06', en: 'Sunday service', es: 'Culto dominical', time: '11:00 AM' }, memberTok);
check('member adds event', r.status === 200 && r.data?.id, r);
const evId = r.data?.id;

r = await j('GET', '/events?since=2026-01-01', null);
check('public reads events', r.status === 200 && r.data.some((e) => e.id === evId && e.en === 'Sunday service'), r);

r = await j('PUT', `/events/${evId}`, { date: '2026-12-06', en: 'Sunday service (updated)', type: 'church' }, tok2);
check('owner edits event', r.status === 200, r);

r = await j('DELETE', `/events/${evId}`, null, tok2);
check('owner deletes event', r.status === 200, r);

r = await j('GET', '/events?since=2026-01-01', null);
check('event gone after delete', r.status === 200 && !r.data.some((e) => e.id === evId), r);

// 10. live status + state
r = await j('POST', '/live/state', { live: true }, memberTok);
check('go live', r.status === 200, r);
r = await j('GET', '/live/status');
check('public live flag true', r.status === 200 && r.data.live === true, r);
r = await j('POST', '/live/state', { live: false }, memberTok);
r = await j('GET', '/live/status');
check('end stream, flag false', r.status === 200 && r.data.live === false, r);

// 11. unauth guard on members area
r = await j('GET', '/members');
check('members needs auth', r.status === 401, r);

// 12. logout invalidates
r = await j('POST', '/auth/logout', null, tok2);
check('logout', r.status === 200, r);
r = await j('GET', '/auth/me', null, tok2);
check('token dead after logout', r.status === 401, r);

const ok = results.every((x) => x.ok);
console.log('=== backend smoke test ===');
for (const x of results) console.log(`  [${x.ok ? 'PASS' : 'FAIL'}] ${x.name}  ${x.ok ? '' : JSON.stringify(x.detail && x.detail.data ? x.detail.data : x.detail)}`);
console.log(ok ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(ok ? 0 : 1);
