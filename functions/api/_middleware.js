import { getAuthUser } from './_lib/auth.js';
import { err } from './_lib/http.js';

// Public endpoints that don't require a session yet.
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register-school', '/api/auth/find-school', '/api/auth/setup-super', '/api/parent/get-student', '/api/parent/submit-feedback', '/api/parent/list-messages', '/api/parent/send-message', '/api/parent/get-garden-diary', '/api/parent/add-note', '/api/parent/get-learning-report', '/api/health'];

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const user = await getAuthUser(context.env, token);
  if (!user) return err('unauthorized', 401);

  // مسیرهای سوپرادمین فقط برای کاربر با is_super=1
  if (url.pathname.startsWith('/api/super/') && !user.is_super) {
    return err('forbidden: super admin only', 403);
  }
  context.data.user = user;
  return next();
}
