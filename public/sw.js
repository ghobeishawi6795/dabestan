// باغچهٔ درس — Service Worker
// فقط پوستهٔ برنامه (HTML/CSS/JS استاتیک + آیکون‌ها) کش می‌شه.
// همهٔ درخواست‌های /api/ همیشه از شبکه می‌رن — هرگز کش/آفلاین نمی‌شن،
// چون داده‌ها زنده و وابسته به نشست کاربرن و کش کردنشون باعث باگ می‌شه.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `baghche-shell-${CACHE_VERSION}`;

const SHELL_FILES = [
  '/login.html',
  '/admin.html',
  '/teacher.html',
  '/student.html',
  '/parent.html',
  '/review.html',
  '/task.html',
  '/assets/style.css',
  '/assets/api.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // API calls: always network, never cached/served from cache.
  if (url.pathname.startsWith('/api/')) return;

  // App shell: cache-first, falling back to network, and refreshing the cache in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
