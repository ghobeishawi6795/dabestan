import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.toStudentId) return err('toStudentId required');
  if (body.toStudentId === student.id) return err('نمی‌تونی به خودت های‌فایو بفرستی', 400);

  const message = (body.message || '').toString().slice(0, 200) || null;

  // گیرنده باید دانش‌آموز فعالِ همون کلاس فرستنده باشه (جلوگیری از ارسال به کاربر دلخواه/مدرسهٔ دیگه)
  const recipient = await env.DB.prepare(
    `SELECT id FROM users WHERE id = ? AND role = 'student' AND is_active = 1 AND class_id = ?`
  ).bind(body.toStudentId, student.class_id).first();
  if (!recipient) return err('همکلاسی موردنظر پیدا نشد', 404);

  await env.DB.prepare(
    'INSERT INTO high_fives (from_student_id, to_student_id, message) VALUES (?, ?, ?)'
  ).bind(student.id, body.toStudentId, message).run();

  return json({ ok: true });
}
