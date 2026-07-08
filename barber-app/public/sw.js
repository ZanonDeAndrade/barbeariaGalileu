const CACHE = 'barbearia-v3';
// Cache separado que guarda o contexto de re-inscricao push; precisa
// sobreviver a trocas de versao do Service Worker.
const PUSH_CONTEXT_CACHE = 'push-config';
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
      await Promise.all(
        keys
          .filter((key) => key !== CACHE && key !== PUSH_CONTEXT_CACHE)
          .map((key) => caches.delete(key)),
      );
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

// ---------------------------------------------------------------------------
// Web Push (notificacoes proprias do PWA)
// ---------------------------------------------------------------------------

const PUSH_CONTEXT_KEY = '/__push_context__';
const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function readPushContext() {
  try {
    const cache = await caches.open(PUSH_CONTEXT_CACHE);
    const response = await cache.match(PUSH_CONTEXT_KEY);
    if (!response) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data = { title: 'Barbearia', body: event.data.text() };
    }
  }

  const title = data.title || 'Barbearia';
  const options = {
    body: data.body || '',
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: {
      url: data.url || '/',
      type: data.type || null,
      appointmentId: data.appointmentId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const absoluteUrl = new URL(targetUrl, self.location.origin);

      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === absoluteUrl.origin) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(absoluteUrl.href);
            } catch (error) {
              client.postMessage({ type: 'PUSH_NAVIGATE', url: absoluteUrl.href });
            }
          } else {
            client.postMessage({ type: 'PUSH_NAVIGATE', url: absoluteUrl.href });
          }
          return;
        }
      }

      await self.clients.openWindow(absoluteUrl.href);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const context = await readPushContext();
      if (!context || !context.vapidPublicKey || !context.subscribeUrl) {
        return;
      }

      try {
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(context.vapidPublicKey),
        });

        await fetch(context.subscribeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(context.headers || {}),
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            ...(context.extra || {}),
          }),
        });
      } catch (error) {
        // Silencioso: sera refeito na proxima abertura do app.
      }
    })(),
  );
});
