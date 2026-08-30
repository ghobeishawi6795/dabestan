// ثبت Service Worker برای حالت اپلیکیشن (PWA) — روی هر صفحه لود می‌شه.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
