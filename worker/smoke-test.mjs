// Lakeview Fellowship backend — smoke test against local wrangler dev (D1 local).
// Usage:  cd worker && npx wrangler dev --local --port 8787  (in one shell)
//         then  node smoke-test.mjs
const BASE = process.env.BASE || 'http://127.0.0.1:8787';

const j = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
};

const results = [];
const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });

// Health
let r = await j('GET', '/_health');
check('health', r.status === 200 && r.data.ok === true, r);

// Public events initially empty
r = await j('GET', '/events?since=2026-01-01');
check('events empty', r.status === 200 && Array.isArray(r.data) && r.data.length === 0, r);

// Seed an owner directly via SQL? Can't from HTTP. Instead test invite flow needs a member.
// We create the first owner by direct SQL in the README; for the smoke test we accept-invite
// then need an owner... invite requires an owner. So: seed owner via SQL before dev,
// then accept an invite the owner makes.
// Here we just verify the unauth guards + login rejection.
r = await j('POST', '/auth/login', { email: 'nobody@example.com', password: 'x' });
check('login rejects unknown', r.status === 401, r);

r = await j('GET', '/members');
check('members needs auth', r.status === 401, r);

const pass = results.every((x) => x.ok);
console.log('\n=== results ===');
for (const x of results) console.log(`  [${x.ok ? 'PASS' : 'FAIL'}] ${x.name}`);
console.log(pass ? '\nALL PASS' : '\nSOME FAILED');
process.exit(pass ? 0 : 1);
