import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT * FROM parent_notes
     WHERE student_id = ? AND COALESCE(is_private, 0) = 0
     ORDER BY created_at DESC LIMIT 50`
  ).bind(student.id).all();

  return json({ notes: results });
}
