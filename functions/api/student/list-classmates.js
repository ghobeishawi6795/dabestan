import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);
  if (!student.class_id) return json({ classmates: [] });

  const { results } = await env.DB.prepare(
    `SELECT id, full_name, avatar, avatar_photo FROM users
     WHERE class_id = ? AND role = 'student' AND is_active = 1 AND id != ?
     ORDER BY full_name ASC`
  ).bind(student.class_id, student.id).all();

  return json({ classmates: results });
}
