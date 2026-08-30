import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId) return err('assignmentId is required');

  const assignment = await env.DB.prepare('SELECT id FROM assignments WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(body.assignmentId, teacher.id, teacher.school_id).first();
  if (!assignment) return err('assignment not found', 404);

  const submissionCount = await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ?')
    .bind(body.assignmentId).first();
  if (submissionCount.n > 0) return err('دانش‌آموزی برای این تکلیف پاسخ ارسال کرده — قابل حذف نیست', 409);

  await env.DB.prepare('DELETE FROM lesson_assignments WHERE assignment_id = ?').bind(body.assignmentId).run();
  await env.DB.prepare('DELETE FROM assignment_questions WHERE assignment_id = ?').bind(body.assignmentId).run();
  await env.DB.prepare('DELETE FROM assignments WHERE id = ?').bind(body.assignmentId).run();

  return json({ ok: true });
}
