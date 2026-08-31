(function () {
  const KEY = 'hw_theme';
  function apply(mode) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
  const saved = localStorage.getItem(KEY) || 'light';
  apply(saved);

  window.toggleTheme = function () {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    apply(next);
    localStorage.setItem(KEY, next);
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => { btn.textContent = next === 'dark' ? '☀️' : '🌙'; });
  };

  window.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => { btn.textContent = isDark ? '☀️' : '🌙'; });
  });

  // رنگ اختصاصی مدرسه — یک هگز پایه می‌گیره و سایه‌های روشن/تیره‌ش رو حساب می‌کنه
  function shade(hex, percent) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    r = Math.round((t - r) * p) + r;
    g = Math.round((t - g) * p) + g;
    b = Math.round((t - b) * p) + b;
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  window.applySchoolThemeColor = function (hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const root = document.documentElement.style;
    root.setProperty('--leaf', hex);
    root.setProperty('--leaf-dark', shade(hex, -0.3));
    root.setProperty('--leaf-pale', shade(hex, 0.8));
  };
})();
