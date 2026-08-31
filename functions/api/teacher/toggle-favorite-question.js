import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.questionId) return err('questionId is required');

  const question = await env.DB.prepare('SELECT id, is_favorite FROM question_bank WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(body.questionId, teacher.id, teacher.school_id).first();
  if (!question) return err('question not found', 404);

  const next = question.is_favorite ? 0 : 1;
  await env.DB.prepare('UPDATE question_bank SET is_favorite = ? WHERE id = ?').bind(next, body.questionId).run();
  return json({ ok: true, isFavorite: !!next });
}
