import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const teacher = request.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('teacher access required', 403);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return err('invalid JSON');
  }

  const questionId = Number(body?.question_id);
  const skillId = Number(body?.skill_id);

  if (!Number.isInteger(questionId) || questionId <= 0) {
    return err('question_id is required');
  }

  if (!Number.isInteger(skillId) || skillId <= 0) {
    return err('skill_id is required');
  }

  const question = await env.DB.prepare(`
    SELECT id
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

  const skill = await env.DB.prepare(`
    SELECT id
    FROM learning_skills
    WHERE id = ?
      AND school_id = ?
  `).bind(
    skillId,
    teacher.school_id
  ).first();

  if (!skill) {
    return err('skill not found', 404);
  }

  await env.DB.prepare(`
    DELETE FROM question_skills
    WHERE question_id = ?
      AND skill_id = ?
  `).bind(
    questionId,
    skillId
  ).run();

  return json({
    ok: true,
    questionId,
    skillId,
    unlinked: true
  });
}
