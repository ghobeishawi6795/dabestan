import { json, err } from '../_lib/http.js';
import { verifyPassword, createSessionToken } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { schoolId, username, password } = body;
  if (!schoolId || !username || !password) return err('schoolId, username, password are required');

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const normalizedUsername = String(username).trim().toLowerCase();

  const ipLimit = await rateLimit(
    env,
    `login-ip:${ip}`,
    30
  );

  if (!ipLimit.allowed) {
    return err(`too many login attempts; retry after ${ipLimit.retryAfter} seconds`, 429);
  }

  const accountLimit = await rateLimit(
    env,
    `login-account:${ip}:${String(schoolId)}:${normalizedUsername}`,
    8
  );

  if (!accountLimit.allowed) {
    return err(`too many login attempts; retry after ${accountLimit.retryAfter} seconds`, 429);
  }

  const user = await env.DB.prepare(
    'SELECT id, school_id, role, username, password_hash, password_salt, full_name, is_active, growth_points, is_super FROM users WHERE school_id = ? AND username = ?'
  ).bind(schoolId, username).first();

  // Same generic error whether the user doesn't exist or the password is wrong — avoids username enumeration.
  if (!user || !user.is_active) return err('invalid credentials', 401);

  const valid = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) return err('invalid credentials', 401);

  const token = await createSessionToken(env, { userId: user.id, schoolId: user.school_id, role: user.role });
  return json({
    token,
    user: { id: user.id, role: user.role, fullName: user.full_name, username: user.username, growthPoints: user.growth_points, isSuper: !!user.is_super },
  });
    }
