import { getAuthUser } from './_lib/auth.js';
import { err } from './_lib/http.js';

// Public endpoints that don't require a session yet.
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register-school', '/api/auth/find-school', '/api/parent/get-student', '/api/parent/submit-feedback', '/api/health'];

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const user = await getAuthUser(context.env, token);
  if (!user) return err('unauthorized', 401);

  // Downstream handlers read context.data.user — never re-derive identity from client-supplied ids.
  context.data.user = user;
  return next();
}
