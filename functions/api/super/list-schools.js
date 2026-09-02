import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT s.id, s.name, s.city, s.created_at,
            (SELECT COALESCE(MAX(is_active),1) FROM users u WHERE u.school_id = s.id) AS enabled,
            (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'teacher') AS teacher_count,
            (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'student') AS student_count
     FROM schools s
     ORDER BY s.id DESC`
  ).all();

  return json({ schools: results });
}
