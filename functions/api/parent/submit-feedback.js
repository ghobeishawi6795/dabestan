import { json, err } from '../_lib/http.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';

// عمداً بدون رمز — دسترسی با همون parent_code کنترل می‌شه (مثل get-student.js)
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.code || !body?.submissionId || !body?.rating) {
    return err('code, submissionId, rating are required');
  }
  if (body.rating < 1 || body.rating > 5) return err('rating must be between 1 and 5');

  const student = await env.DB.prepare(`SELECT id FROM users WHERE parent_code = ? AND role = 'student'`)
    .bind(body.code).first();
  if (!student) return err('invalid code', 404);

  // این ارسالی باید واقعاً مال همین دانش‌آموز و بررسی‌شده باشه
  const submission = await env.DB.prepare(
    `SELECT sub.id, a.teacher_id FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE sub.id = ? AND sub.student_id = ? AND sub.status = 'reviewed'`
  ).bind(body.submissionId, student.id).first();
  if (!submission) return err('submission not found or not yet reviewed', 404);

  const existing = await env.DB.prepare('SELECT id FROM parent_feedback WHERE submission_id = ?').bind(body.submissionId).first();
  if (existing) {
    await env.DB.prepare('UPDATE parent_feedback SET rating = ?, comment = ? WHERE id = ?')
      .bind(body.rating, body.comment || null, existing.id).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO parent_feedback (student_id, teacher_id, submission_id, rating, comment) VALUES (?, ?, ?, ?, ?)'
    ).bind(student.id, submission.teacher_id, body.submissionId, body.rating, body.comment || null).run();
  }

  await checkAndAwardTeacherBadges(env, submission.teacher_id);
  return json({ ok: true });
}
