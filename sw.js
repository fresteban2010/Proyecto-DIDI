/**
 * DIDI TRACKER - Service Worker (sw.js)
 * Estrategias:
 *  - Navegación (HTML): Network-First con fallback a caché (soporte offline real).
 *  - Assets locales (css/js/iconos): Stale-While-Revalidate.
 *  - CDNs (Chart.js, Lucide, Google Fonts): Cache-First.
 */

const SW_CACHE = 'didi-tracker-v10';

// Assets locales esenciales para operación offline
const LOCAL_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/app.js',
  './manifest.json',
  './assets/icons/logo-tacometro.png',
  './assets/icons/favicon.svg',
  './assets/icons/favicon-16x16.png',
  './assets/icons/favicon-32x32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/pwa-icon-192.png',
  './assets/icons/pwa-icon-512.png',
  './assets/icons/pwa-icon-192-maskable.png',
  './assets/icons/pwa-icon-512-maskable.png'
];

const CDN_PREFIXES = [
  'https://cdn.jsdelivr.net/',
  'https://unpkg.com/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/'
];

// INSTALACIÓN: pre-cachear núcleo local
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SW_CACHE)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN: limpiar cachés antiguas y tomar control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== SW_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Mensaje desde la app: activar nueva versión de inmediato
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function esCdn(url) {
  return CDN_PREFIXES.some(prefix => url.startsWith(prefix));
}

function esAssetLocal(url) {
  const urlObj = new URL(url);
  return urlObj.origin === self.location.origin;
}

// FETCH: enrutar según tipo de recurso
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = request.url;

  // 1) Navegación (HTML): Network-First con fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SW_CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2) CDNs: Cache-First (tolerante a respuestas opacas cross-origin)
  if (esCdn(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const copy = response.clone();
          caches.open(SW_CACHE).then(cache => cache.put(request, copy));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3) Assets locales: Stale-While-Revalidate
  if (esAssetLocal(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(SW_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
