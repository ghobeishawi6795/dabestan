// Service Worker v3 - Clean cache management
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'dabestan-' + CACHE_VERSION;

const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/assets/style.css',
  '/assets/api.js',
  '/assets/date-fa.js',
  '/assets/theme.js',
  '/assets/pwa.js',
  '/assets/install-pwa.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  console.log('[SW v3] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW v3] Activating');
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // API requests: always network
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Static assets: Network First
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
