const CACHE_NAME = 'scrumpy-static-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './index.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Network first: always try a fresh copy, fall back to cache only when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/config.js')) return;

  // Revalidate assets past the HTTP cache (GitHub Pages sends max-age=600).
  // Navigations keep their own request so redirects (e.g. /scrumpy -> /scrumpy/) still work.
  const fresh = request.mode === 'navigate' ? fetch(request) : fetch(request, { cache: 'no-cache' });

  event.respondWith(
    fresh
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
