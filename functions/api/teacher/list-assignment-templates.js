import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    'SELECT id, title, question_ids FROM assignment_templates WHERE teacher_id = ? AND school_id = ? ORDER BY id DESC'
  ).bind(teacher.id, teacher.school_id).all();

  const templates = results.map((t) => {
    let questionIds = [];
    try { questionIds = JSON.parse(t.question_ids); } catch { /* ignore malformed */ }
    return { id: t.id, title: t.title, questionCount: questionIds.length, questionIds };
  });

  return json({ templates });
}
