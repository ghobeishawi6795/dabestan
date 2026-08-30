import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.teacherId || !body?.fullName || !body?.username) {
    return err('teacherId, fullName, username are required');
  }

  const teacher = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'teacher'`)
    .bind(body.teacherId, admin.school_id).first();
  if (!teacher) return err('teacher not found', 404);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE school_id = ? AND username = ? AND id != ?')
    .bind(admin.school_id, body.username, body.teacherId).first();
  if (existing) return err('username already taken in this school', 409);

  await env.DB.prepare('UPDATE users SET full_name = ?, username = ? WHERE id = ?')
    .bind(body.fullName, body.username, body.teacherId).run();

  return json({ ok: true });
}
