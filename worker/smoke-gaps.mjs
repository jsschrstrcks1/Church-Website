// Smoke for the three closed gaps: response-reviewed flag, response delete/form delete,
// rsvp option persistence + read-back, newsletter unpublish.
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8787';
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

let r = await j('POST', '/auth/bootstrap', { key: 'test-bootstrap-key-abc', email: 'o@gaps.org', password: 'password123', name: 'G' });
const tok = r.data?.token; check('bootstrap', r.status === 200 && !!tok, r);

// newsletter
r = await j('POST', '/newsletters', { name: 'Gap Test' }, tok);
const nlId = r.data?.id; check('create newsletter', r.status === 200 && !!nlId, r);
// form + a response (public)
r = await j('POST', '/forms', { newsletterId: nlId, title: 'F' }, tok);
const fid = r.data?.id; check('create form', r.status === 200 && !!fid, r);
r = await j('POST', `/forms/${fid}/responses`, { payload: { email: 'a@b.c' }, respondent: 'anon' });
check('public form response', r.status === 200, r);
const resps = await j('GET', `/forms/${fid}/responses`, undefined, tok);
const rid = resps.data?.[0]?.id;
check('response has reviewed=false', resps.status === 200 && resps.data?.[0]?.reviewed === false, resps);

// toggle reviewed
r = await j('POST', `/forms/${fid}/responses/${rid}/review`, {}, tok);
check('toggle reviewed -> true', r.status === 200 && r.data?.reviewed === true, r);
r = await j('GET', `/forms/${fid}/responses`, undefined, tok);
check('reviewed persisted', r.status === 200 && r.data?.[0]?.reviewed === true, r);
r = await j('POST', `/forms/${fid}/responses/${rid}/review`, {}, tok);
check('toggle reviewed -> false', r.status === 200 && r.data?.reviewed === false, r);

// delete single response
r = await j('DELETE', `/forms/${fid}/responses/${rid}`, undefined, tok);
check('delete response', r.status === 200, r);
r = await j('GET', `/forms/${fid}/responses`, undefined, tok);
check('response gone', r.status === 200 && r.data.length === 0, r);
// delete form + its responses
r = await j('POST', `/forms/${fid}/responses`, { payload: { email: 'x@y.z' } });
r = await j('DELETE', `/forms/${fid}`, undefined, tok);
check('delete form', r.status === 200, r);
r = await j('GET', `/forms/${fid}/responses`, undefined, tok);
check('form responses gone after form delete', r.status === 200 && r.data.length === 0, r);

// rsvp option + read-back
r = await j('POST', '/rsvps', { newsletterId: nlId, eventId: 'evt-1', guestName: 'Gail', guests: 2, option: 'Going' });
check('rsvp stores option', r.status === 200 && !!r.data?.id, r);
r = await j('POST', '/rsvps', { newsletterId: nlId, eventId: 'evt-1', guestName: 'Ned', guests: 1, option: 'Maybe' });
r = await j('GET', `/rsvps?newsletterId=${nlId}`, undefined, tok);
const byNl = r.data?.filter((x) => x.eventId === 'evt-1');
const goingByNl = byNl?.find((x) => x.option === 'Going');
check('rsvp read-back by newsletter', r.status === 200 && byNl?.length === 2 && !!goingByNl?.guestName === true, r);
r = await j('GET', '/rsvps?eventId=evt-1', undefined, tok);
check('rsvp read-back by event', r.status === 200 && r.data?.length === 2, r);

// unpublish
r = await j('POST', `/newsletters/${nlId}/publish`, { slug: 'gap' }, tok);
check('publish', r.status === 200, r);
r = await j('GET', `/newsletters/${nlId}`, undefined, tok);
check('published true', r.status === 200 && r.data.published === true, r);
r = await j('POST', `/newsletters/${nlId}/unpublish`, {}, tok);
check('unpublish', r.status === 200 && r.data?.ok === true, r);
r = await j('GET', `/newsletters/${nlId}`, undefined, tok);
check('published false after unpublish', r.status === 200 && r.data.published === false, r);

const ok = results.every((x) => x.ok);
console.log('=== closed-gaps smoke ===');
for (const x of results) console.log(`  [${x.ok ? 'PASS' : 'FAIL'}] ${x.name}${x.ok ? '' : '  ' + JSON.stringify(x.detail?.data || x.detail)}`);
console.log(ok ? '\nALL PASS' : '\nFAILURES');
process.exit(ok ? 0 : 1);
