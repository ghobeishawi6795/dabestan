// لایهٔ ارتباط با بک‌اند — نشست در sessionStorage ذخیره می‌شه (نه localStorage)
// تا هر تب مرورگر نشست جدای خودش رو داشته باشه (باگ قدیمی: overwrite شدن نشست بین تب‌ها).

const Auth = {
  save({ token, user, schoolId }) {
    sessionStorage.setItem('hw_token', token);
    sessionStorage.setItem('hw_user', JSON.stringify(user));
    sessionStorage.setItem('hw_school_id', schoolId);
  },
  token() { return sessionStorage.getItem('hw_token'); },
  user() {
    try { return JSON.parse(sessionStorage.getItem('hw_user') || 'null'); }
    catch { return null; }
  },
  schoolId() { return sessionStorage.getItem('hw_school_id'); },
  clear() {
    sessionStorage.removeItem('hw_token');
    sessionStorage.removeItem('hw_user');
    sessionStorage.removeItem('hw_school_id');
  },
  isLoggedIn() { return !!this.token(); },
  updateUser(patch) {
    const u = { ...(this.user() || {}), ...patch };
    sessionStorage.setItem('hw_user', JSON.stringify(u));
    return u;
  },
};

async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.token();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    Auth.clear();
    window.location.href = 'login.html';
    throw new Error('unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

// همهٔ صفحات محافظت‌شده این تابع رو در ابتدای کار صدا بزنن
function requireAuth(allowedRoles) {
  const user = Auth.user();
  if (!Auth.isLoggedIn() || !user) {
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}
