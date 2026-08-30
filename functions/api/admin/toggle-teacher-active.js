import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.teacherId || typeof body.isActive !== 'boolean') return err('teacherId and isActive are required');

  const teacher = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'teacher'`)
    .bind(body.teacherId, admin.school_id).first();
  if (!teacher) return err('teacher not found', 404);

  await env.DB.prepare('UPDATE users SET is_active = ? WHERE id = ?').bind(body.isActive ? 1 : 0, body.teacherId).run();
  return json({ ok: true });
}
