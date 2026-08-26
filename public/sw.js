// Service Worker — Multiplica Plus v8.2.3
const CACHE_NAME = 'multiplica-plus-v8.2.3-brand-v1';
const ASSETS = [
  '/manifest.json?v=brand-823',
  '/logo.png?v=brand-823',
  '/banner.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Supabase e qualquer serviço externo nunca passam pelo cache do PWA.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML/navegação sempre tenta a versão atual da rede primeiro.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Assets estáticos: cache-first, com atualização silenciosa quando online.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response?.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
      return cached || network;
    })
  );
});
