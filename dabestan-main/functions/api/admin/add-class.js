import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.name) return err('name is required');

  let teacherId = null;
  if (body.teacherId) {
    const teacher = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND school_id = ? AND role = ?')
      .bind(body.teacherId, admin.school_id, 'teacher')
      .first();
    if (!teacher) return err('teacherId does not belong to this school', 400);
    teacherId = teacher.id;
  }

  const result = await env.DB.prepare(
    'INSERT INTO classes (school_id, teacher_id, name, grade) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(admin.school_id, teacherId, body.name, body.grade ?? null).first();

  return json({ ok: true, classId: result.id });
}
