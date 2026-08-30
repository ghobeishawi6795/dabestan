import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT a.id, a.title, a.due_at, a.created_at, a.class_id, c.name AS class_name,
            (SELECT COUNT(*) FROM users s WHERE s.class_id = a.class_id AND s.role = 'student') AS class_size,
            (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status IN ('submitted','reviewed')) AS submitted_count
     FROM assignments a JOIN classes c ON c.id = a.class_id
     WHERE a.teacher_id = ? AND a.school_id = ?
     ORDER BY a.id DESC LIMIT 100`
  ).bind(teacher.id, teacher.school_id).all();

  return json({ assignments: results });
}
