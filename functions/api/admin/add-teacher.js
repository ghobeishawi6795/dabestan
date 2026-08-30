import { hashPassword } from '../_lib/auth.js';
import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.password || !body?.fullName) {
    return err('username, password, fullName are required');
  }
  if (body.password.length < 8) return err('password must be at least 8 characters');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE school_id = ? AND username = ?')
    .bind(admin.school_id, body.username)
    .first();
  if (existing) return err('username already taken in this school', 409);

  const { hash, salt } = await hashPassword(body.password);
  const result = await env.DB.prepare(
    `INSERT INTO users (school_id, role, username, password_hash, password_salt, full_name)
     VALUES (?, 'teacher', ?, ?, ?, ?) RETURNING id`
  ).bind(admin.school_id, body.username, hash, salt, body.fullName).first();

  return json({ ok: true, teacherId: result.id });
}
