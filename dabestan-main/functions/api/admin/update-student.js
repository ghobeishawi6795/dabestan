import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.studentId || !body?.fullName || !body?.username || !body?.classId) {
    return err('studentId, fullName, username, classId are required');
  }

  const student = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'student'`)
    .bind(body.studentId, admin.school_id).first();
  if (!student) return err('student not found', 404);

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?')
    .bind(body.classId, admin.school_id).first();
  if (!cls) return err('classId does not belong to this school', 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE school_id = ? AND username = ? AND id != ?')
    .bind(admin.school_id, body.username, body.studentId).first();
  if (existing) return err('username already taken in this school', 409);

  await env.DB.prepare('UPDATE users SET full_name = ?, username = ?, class_id = ? WHERE id = ?')
    .bind(body.fullName, body.username, body.classId, body.studentId).run();

  return json({ ok: true });
}
