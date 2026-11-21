// Cloudflare Pages Function: SPA fallback for the /app/* client-side routes.
// /app/assets/* -> served from the static store; any other /app/* path -> the app shell.
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/app/assets/')) {
    return env.ASSETS.fetch(new URL(request.url));
  }
  const index = await env.ASSETS.fetch(new URL('/app/index.html', request.url));
  return new Response(index.body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
  });
}
