import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.toStudentId) return err('toStudentId required');
  if (Number(body.toStudentId) === student.id) {
    return err('نمی‌توانی به خودت های‌فایو بفرستی', 400);
  }

  // چک کن هدف دانش‌آموز هم‌مدرسه‌ایه
  const target = await env.DB.prepare(
    'SELECT id, role FROM users WHERE id = ? AND school_id = ? AND role = ?'
  ).bind(body.toStudentId, student.school_id, 'student').first();
  if (!target) return err('دانش‌آموز مقصد معتبر نیست', 404);

  // محدودیت: حداکثر ۰ های‌فایو در ساعت (جلوگیری از اسپم)
  const recentCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM high_fives 
     WHERE from_student_id = ? AND created_at > datetime('now', '-1 hour')`
  ).bind(student.id).first();
  if (recentCount.n >= 10) return err('تعداد های‌فایو در ساعت گذشته زیاد بود. کمی صبر کن.', 429);

  await env.DB.prepare(
    'INSERT INTO high_fives (from_student_id, to_student_id, message) VALUES (?, ?, ?)'
  ).bind(student.id, body.toStudentId, (body.message || '').slice(0, 200)).run();

  return json({ ok: true });
}
