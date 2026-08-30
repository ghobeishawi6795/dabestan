import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.classId || !body?.name) return err('classId and name are required');

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?')
    .bind(body.classId, admin.school_id).first();
  if (!cls) return err('class not found', 404);

  let teacherId = null;
  if (body.teacherId) {
    const teacher = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'teacher'`)
      .bind(body.teacherId, admin.school_id).first();
    if (!teacher) return err('teacherId does not belong to this school', 400);
    teacherId = teacher.id;
  }

  await env.DB.prepare('UPDATE classes SET name = ?, grade = ?, teacher_id = ? WHERE id = ?')
    .bind(body.name, body.grade ?? null, teacherId, body.classId).run();

  return json({ ok: true });
}
