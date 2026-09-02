import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const { results: received } = await env.DB.prepare(
    `SELECT hf.*, u.full_name AS from_name
     FROM high_fives hf JOIN users u ON u.id = hf.from_student_id
     WHERE hf.to_student_id = ?
     ORDER BY hf.created_at DESC
     LIMIT 50`
  ).bind(student.id).all();

  const { results: sent } = await env.DB.prepare(
    `SELECT hf.*, u.full_name AS to_name
     FROM high_fives hf JOIN users u ON u.id = hf.to_student_id
     WHERE hf.from_student_id = ?
     ORDER BY hf.created_at DESC
     LIMIT 50`
  ).bind(student.id).all();

  return json({ received, sent });
}
