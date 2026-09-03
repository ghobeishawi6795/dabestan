import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const teacher = request.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('teacher access required', 403);
  }

  const url = new URL(request.url);
  const questionId = Number(
    url.searchParams.get('question_id')
  );

  if (!Number.isInteger(questionId) || questionId <= 0) {
    return err('question_id is required');
  }

  const question = await env.DB.prepare(`
    SELECT id, title, subject, grade
    FROM question_bank
    WHERE id = ?
      AND teacher_id = ?
      AND school_id = ?
  `).bind(
    questionId,
    teacher.id,
    teacher.school_id
  ).first();

  if (!question) {
    return err('question not found', 404);
  }

  const { results: skills } = await env.DB.prepare(`
    SELECT
      qs.skill_id,
      qs.weight,

      ls.subject,
      ls.grade,
      ls.code,
      ls.name,
      ls.description,
      ls.parent_id,
      ls.position

    FROM question_skills qs
    INNER JOIN learning_skills ls
      ON ls.id = qs.skill_id

    WHERE
      qs.question_id = ?
      AND ls.school_id = ?
      AND ls.is_active = 1

    ORDER BY
      ls.subject ASC,
      ls.grade ASC,
      ls.position ASC,
      ls.id ASC
  `).bind(
    questionId,
    teacher.school_id
  ).all();

  return json({
    ok: true,
    question,
    skills
  });
}
