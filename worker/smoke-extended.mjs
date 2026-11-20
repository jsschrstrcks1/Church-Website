// Extended backend smoke: auth + members + events + newsletters + forms + rsvp + poll + share + files + live.
const BASE = 'http://127.0.0.1:8787';
const j = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
};
const results = [];
const check = (n, c, d) => results.push({ name: n, ok: !!c, detail: d });

// bootstrap owner
let r = await j('POST', '/auth/bootstrap', { key: 'test-bootstrap-key-abc', email: 'owner@l.org', password: 'password123', name: 'Ken' });
check('bootstrap', r.status === 200 && r.data.member?.role === 'owner', r);
const ownerTok = r.data?.token;

// invite + accept member
r = await j('POST', '/members/invite', { email: 'deacon@l.org', name: 'Deacon Doe', role: 'admin' }, ownerTok);
check('create invite (with name)', r.status === 200 && !!r.data?.code, r);
const code = r.data?.code;
r = await j('GET', `/invites/${code}`);
check('public invite lookup', r.status === 200 && r.data?.name === 'Deacon Doe', r);
r = await j('POST', '/auth/accept-invite', { code, email: 'deacon@l.org', password: 'memberpass' });
check('accept invite as admin', r.status === 200 && !!r.data?.token, r);
const memberTok = r.data?.token;

// profile update
r = await j('POST', '/auth/profile', { name: 'Deacon Doe Jr' }, memberTok);
check('update profile name', r.status === 200 && r.data.member?.name === 'Deacon Doe Jr', r);
// change password (wrong current)
r = await j('POST', '/auth/password', { current: 'wrong', next: 'newpass1' }, memberTok);
check('password rejects wrong current', r.status === 400 && r.data.error === 'wrong-current-password', r);

// events
r = await j('POST', '/events', { date: '2026-12-25', en: 'Christmas', type: 'holiday' }, memberTok);
check('add event', r.status === 200 && !!r.data?.id, r);

// newsletters
r = await j('POST', '/newsletters', { title: 'December News', content: { ops: [{ insert: 'Hello ' }, { insert: 'friends', attributes: { bold: true } }, { insert: '\n' }] } }, memberTok);
check('create newsletter', r.status === 200 && !!r.data?.id, r);
const nlId = r.data?.id;
r = await j('GET', `/newsletters/${nlId}`, undefined, memberTok);
check('get newsletter content', r.status === 200 && Array.isArray(r.data.content.ops), r);

// form definition + public response + owner read
r = await j('POST', '/forms', { newsletterId: nlId, title: 'Signup', schema: { fields: [{ key: 'email', type: 'email' }] } }, memberTok);
check('create form', r.status === 200 && !!r.data?.id, r);
const formId = r.data?.id;
r = await j('POST', `/forms/${formId}/responses`, { payload: { email: 'guest@x.com' }, respondent: 'guest' });
check('public form response', r.status === 200, r);
r = await j('GET', `/forms/${formId}/responses`, undefined, memberTok);
check('owner reads responses', r.status === 200 && r.data.length === 1 && r.data[0].payload.email === 'guest@x.com', r);

// rsvp + poll
r = await j('POST', '/rsvps', { newsletterId: nlId, guestName: 'Gail', guests: 2 });
check('rsvp', r.status === 200 && !!r.data?.id, r);
r = await j('POST', '/polls/vote', { pollId: 'poll1', optionText: 'Yes', voter: 'a' });
r = await j('POST', '/polls/vote', { pollId: 'poll1', optionText: 'Yes', voter: 'b' });
r = await j('POST', '/polls/vote', { pollId: 'poll1', optionText: 'No', voter: 'c' });
r = await j('GET', '/polls/poll1/votes', undefined, memberTok);
const votes = r.data?.find?.((x) => x.option_text === 'Yes');
check('poll tally', r.status === 200 && votes?.votes === 2, r);

// share settings
r = await j('GET', '/share/settings');
check('share settings default', r.status === 200 && Object.keys(r.data || {}).length === 0, r);
r = await j('PUT', '/share/settings', { intro: 'Welcome' }, memberTok);
r = await j('GET', '/share/settings');
check('share settings saved', r.status === 200 && r.data.intro === 'Welcome', r);

// live
r = await j('POST', '/live/state', { live: true }, memberTok);
r = await j('GET', '/live/status');
check('go live flag', r.status === 200 && r.data.live === true, r);

// file upload + serve
const b64 = Buffer.from('PNGFAKE').toString('base64');
r = await j('POST', '/files', { name: 'logo.png', mime: 'image/png', data: b64 }, memberTok);
check('upload file', r.status === 200 && !!r.data?.id, r);
const fileId = r.data?.id;
let fr2 = await fetch(`${BASE}/files/${fileId}`);
const bodytxt = await fr2.text();
check('serve file bytes', fr2.status === 200 && bodytxt === 'PNGFAKE', { status: fr2.status });

const ok = results.every((x) => x.ok);
console.log('=== extended backend smoke ===');
for (const x of results) console.log(`  [${x.ok ? 'PASS' : 'FAIL'}] ${x.name}  ${x.ok ? '' : JSON.stringify(x.detail?.data || x.detail)}`);
console.log(ok ? '\nALL PASS' : '\nFAILURES');
process.exit(ok ? 0 : 1);
