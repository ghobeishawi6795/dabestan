import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const body = await request.json().catch(() => null);
  if (!body?.note) return err('note is required');

  let studentId;

  if (user.role === 'parent') {
    // والدین: پیدا کردن فرزند از parent_code
    const student = await env.DB.prepare(
      'SELECT id FROM users WHERE parent_code = ? AND school_id = ? AND role = ?'
    ).bind(user.parent_code || user.parentCode, user.school_id, 'student').first();
    if (!student) return err('فرزندی با این کد والدین پیدا نشد', 404);
    studentId = student.id;
  } else if (user.role === 'teacher') {
    // معلم: studentId مستقیم
    if (!body.studentId) return err('studentId is required for teachers');
    const target = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ? AND school_id = ? AND role = ?'
    ).bind(body.studentId, user.school_id, 'student').first();
    if (!target) return err('دانش‌آموز معتبر نیست', 404);
    studentId = target.id;
  } else {
    return err('forbidden', 403);
  }

  await env.DB.prepare(
    'INSERT INTO parent_notes (student_id, parent_name, note, is_private) VALUES (?, ?, ?, ?)'
  ).bind(studentId, user.full_name, body.note, body.isPrivate ? 1 : 0).run();

  return json({ ok: true });
}
