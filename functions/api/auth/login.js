import { json, err } from '../_lib/http.js';
import { verifyPassword, createSessionToken } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { schoolId, username, password } = body;
  if (!schoolId || !username || !password) return err('schoolId, username, password are required');

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
