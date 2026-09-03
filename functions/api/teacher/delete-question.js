import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.questionId) return err('questionId is required');

  const question = await env.DB.prepare('SELECT id FROM question_bank WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(body.questionId, teacher.id, teacher.school_id).first();
  if (!question) return err('question not found', 404);

  const usage = await env.DB.prepare('SELECT COUNT(*) AS n FROM assignment_questions WHERE question_id = ?')
    .bind(body.questionId).first();
  if (usage.n > 0) return err('این سؤال در یک یا چند تکلیف استفاده شده — قابل حذف نیست', 409);

  await env.DB.prepare(
  `DELETE FROM question_versions WHERE question_id = ?`
).bind(questionId).run();

await env.DB.prepare('DELETE FROM question_bank WHERE id = ?').bind(body.questionId).run();
  return json({ ok: true });
}
