import { hashPassword } from '../_lib/auth.js';
import { json, err } from '../_lib/http.js';

function randomCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.password || !body?.fullName || !body?.classId) {
    return err('username, password, fullName, classId are required');
  }
  if (body.password.length < 8) return err('password must be at least 8 characters');

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?')
    .bind(body.classId, admin.school_id)
    .first();
  if (!cls) return err('classId does not belong to this school', 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE school_id = ? AND username = ?')
    .bind(admin.school_id, body.username)
    .first();
  if (existing) return err('username already taken in this school', 409);

  const { hash, salt } = await hashPassword(body.password);
  const parentCode = randomCode();
  const result = await env.DB.prepare(
    `INSERT INTO users (school_id, role, username, password_hash, password_salt, full_name, class_id, parent_code, avatar)
     VALUES (?, 'student', ?, ?, ?, ?, ?, ?, 'seed_1') RETURNING id`
  ).bind(admin.school_id, body.username, hash, salt, body.fullName, cls.id, parentCode).first();

  return json({ ok: true, studentId: result.id, parentCode });
}
