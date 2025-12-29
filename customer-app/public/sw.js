const CACHE = 'barbearia-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const CACHEABLE_DESTINATIONS = new Set([
  'style',
  'script',
  'worker',
  'image',
  'font',
  'manifest',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Avoid Chrome error for cross-origin requests with only-if-cached.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  // SPA navigation: network-first, fallback to cached index.html when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (error) {
          console.error(error);
          return (await caches.match('/index.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Não cachear chamadas de API/fetch/XHR (evita dados travados).
  if (!CACHEABLE_DESTINATIONS.has(request.destination)) return;

  // Other GETs: cache-first, then network + cache.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => undefined);
        return response;
      } catch (error) {
        console.error(error);
        return Response.error();
      }
    })(),
  );
});
