// Newsletter lifecycle smoke: create -> update content -> publish -> list/filter -> archive.
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

let r = await j('POST', '/auth/bootstrap', { key: 'test-bootstrap-key-abc', email: 'o@l.org', password: 'password123', name: 'O' });
const tok = r.data?.token; check('bootstrap', r.status === 200 && !!tok, r);

// create
r = await j('POST', '/newsletters', { name: 'Church Family', title: '' }, tok);
const id = r.data?.id; check('create', r.status === 200 && !!id, r);

// get (fields camelCased, content parsed)
r = await j('GET', `/newsletters/${id}`, undefined, tok);
const nl = r.data;
check('get maps fields', r.status === 200 && nl.isPrimary === false && nl.isPubliclyListed === true && nl.published === false && nl.status === 'active', r);
check('get has content', r.status === 200 && nl.content && typeof nl.content === 'object', r);

// update content (stores revision)
r = await j('PUT', `/newsletters/${id}`, { content: { title: 'Dec', sections: [] } }, tok);
check('update content', r.status === 200, r);

// list (active only) — should include it
r = await j('GET', '/newsletters', undefined, tok);
check('list active includes it', r.status === 200 && r.data.some((x) => x.id === id), r);

// publish
r = await j('POST', `/newsletters/${id}/publish`, { slug: 'church-family' }, tok);
check('publish', r.status === 200 && !!(r.data?.slug), r);
r = await j('GET', `/newsletters/${id}`, undefined, tok);
check('published flag true', r.status === 200 && r.data.published === true, r);

// archive
r = await j('POST', `/newsletters/${id}/archive`, {}, tok);
r = await j('GET', '/newsletters', undefined, tok);
check('archived hidden from active list', r.status === 200 && !r.data.some((x) => x.id === id), r);
r = await j('GET', '/newsletters?all=1', undefined, tok);
check('archived visible in ?all=1', r.status === 200 && r.data.some((x) => x.id === id && x.status === 'archived'), r);

// toggle-list + reactivate
r = await j('POST', `/newsletters/${id}/toggle-list`, {}, tok);
r = await j('GET', `/newsletters/${id}`, undefined, tok);
check('toggle-list flips', r.status === 200 && r.data.isPubliclyListed === false, r);
r = await j('POST', `/newsletters/${id}/reactivate`, {}, tok);
r = await j('GET', '/newsletters', undefined, tok);
check('reactivate back to active', r.status === 200 && r.data.some((x) => x.id === id && x.status === 'active'), r);

// delete
r = await j('DELETE', `/newsletters/${id}`, undefined, tok);
r = await j('GET', '/newsletters?all=1', undefined, tok);
check('delete removes', r.status === 200 && !r.data.some((x) => x.id === id), r);

const ok = results.every((x) => x.ok);
console.log('=== newsletter lifecycle smoke ===');
for (const x of results) console.log(`  [${x.ok ? 'PASS' : 'FAIL'}] ${x.name}${x.ok ? '' : '  ' + JSON.stringify(x.detail?.data || x.detail)}`);
console.log(ok ? '\nALL PASS' : '\nFAILURES');
process.exit(ok ? 0 : 1);
