// Lakeview Fellowship Church — PWA Service Worker (scope /app/).
// Update strategy: keep the app fresh (network-first for GET), fall back to the cached
// shell when offline, version caches so a deploy never strands visitors on a stale app,
// and never cache API responses (they carry members-only data / live state).
const CACHE = 'lakeview-app-v1';
const SHELL = ['/app/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}) // shell missing during dev is fine; activate still runs
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && !url.pathname.startsWith('/api/')) {
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('/app/'))
      )
  );
});
