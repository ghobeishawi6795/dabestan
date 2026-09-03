import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const questionId = Number(url.searchParams.get('questionId'));
  if (!questionId) return err('questionId is required');

  const q = await env.DB.prepare('SELECT id, teacher_id FROM question_bank WHERE id = ? AND school_id = ?')
    .bind(questionId, teacher.school_id).first();
  if (!q) return err('question not found', 404);

  const { results } = await env.DB.prepare(
    `SELECT version, title, content_json, created_at FROM question_versions
     WHERE question_id = ? ORDER BY version DESC`
  ).bind(questionId).all();

  return json({
    questionId,
    canRestore: q.teacher_id === teacher.id, // فقط صاحب سؤال می‌تونه بازگردانی کنه (توی restore-question-version.js هم دوباره چک می‌شه)
    versions: results,
  });
}
