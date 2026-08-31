import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT s.id, s.full_name AS fullName, c.name AS className
     FROM users s JOIN classes c ON c.id = s.class_id
     WHERE c.teacher_id = ? AND s.role = 'student' AND s.is_active = 1
     ORDER BY c.name, s.full_name`
  ).bind(teacher.id).all();

  return json({ students: results });
}
