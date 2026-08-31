import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.title || !Array.isArray(body.questionIds) || body.questionIds.length === 0) {
    return err('title and at least one questionId are required');
  }

  const placeholders = body.questionIds.map(() => '?').join(',');
  const { results: owned } = await env.DB.prepare(
    `SELECT id FROM question_bank WHERE school_id = ? AND id IN (${placeholders})`
  ).bind(teacher.school_id, ...body.questionIds).all();
  if (owned.length !== body.questionIds.length) return err('one or more questionIds are invalid for this school', 400);

  const row = await env.DB.prepare(
    'INSERT INTO assignment_templates (school_id, teacher_id, title, question_ids) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(teacher.school_id, teacher.id, body.title, JSON.stringify(body.questionIds)).first();

  return json({ ok: true, id: row.id });
}
