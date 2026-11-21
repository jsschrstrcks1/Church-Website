// Cloudflare Pages Function: proxy /api/* on the Pages domain to the deployed Worker,
// so the static app (which calls <origin>/api/...) reaches the real backend. Strips the
// leading /api (the Worker's routes are at the root, e.g. /auth/login, /prayer).
const WORKER = 'https://lakeview-fellowship-backend.inthewake-jerusha.workers.dev';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = WORKER + url.pathname.replace(/^\/api/, '') + url.search;

  const init = {
    method: request.method,
    headers: request.headers,
    // Stream the request body through for POST/PUT/DELETE.
    ...(request.method !== 'GET' && request.method !== 'HEAD' ? { body: request.body } : {})
  };

  const res = await fetch(target, init);
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(res.body, { status: res.status, headers });
}
