import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.studentId || typeof body.isActive !== 'boolean') return err('studentId and isActive are required');

  const student = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'student'`)
    .bind(body.studentId, admin.school_id).first();
  if (!student) return err('student not found', 404);

  await env.DB.prepare('UPDATE users SET is_active = ? WHERE id = ?').bind(body.isActive ? 1 : 0, body.studentId).run();
  return json({ ok: true });
}
