import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT l.id, l.title, l.subject, l.icon, l.position, c.name AS class_name,
            (SELECT COUNT(*) FROM lesson_assignments la WHERE la.lesson_id = l.id) AS assignment_count
     FROM lessons l JOIN classes c ON c.id = l.class_id
     WHERE l.teacher_id = ? AND l.school_id = ? ORDER BY c.id, l.position ASC`
  ).bind(teacher.id, teacher.school_id).all();

  return json({ lessons: results });
}
