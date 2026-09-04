import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data, request }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('class_id') || 0);

  let query = `
    SELECT s.id, s.full_name AS fullName, c.name AS className
    FROM users s
    JOIN classes c ON c.id = s.class_id
    WHERE c.teacher_id = ?
      AND s.role = 'student'
      AND s.is_active = 1
  `;

  const params = [teacher.id];

  if (classId) {
    query += ' AND c.id = ?';
    params.push(classId);
  }

  query += ' ORDER BY c.name, s.full_name';

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return json({ students: results });
}
