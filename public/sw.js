// باغچهٔ درس — Service Worker
// فقط پوستهٔ برنامه (HTML/CSS/JS استاتیک + آیکون‌ها) کش می‌شه.
// همهٔ درخواست‌های /api/ همیشه از شبکه می‌رن — هرگز کش/آفلاین نمی‌شن،
// چون داده‌ها زنده و وابسته به نشست کاربرن و کش کردنشون باعث باگ می‌شه.
const CACHE_VERSION = 'v2';
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

  // App shell: if cached, serve immediately and refresh the cache in the background.
  // If not cached, this NEVER swallows a network failure into an invalid/undefined
  // response — it always returns the real fetch() promise, so a failed request
  // behaves exactly as if there were no service worker at all (no ERR_FAILED trap).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req)
          .then((res) => {
            if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req);
    })
  );
});
