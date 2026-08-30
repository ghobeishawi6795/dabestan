import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data, request }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const url = new URL(request.url);
  const classId = url.searchParams.get('classId');

  let query = `SELECT u.id, u.username, u.full_name, u.avatar, u.growth_points, u.is_active, c.name AS class_name
               FROM users u LEFT JOIN classes c ON c.id = u.class_id
               WHERE u.school_id = ? AND u.role = 'student'`;
  const binds = [admin.school_id];
  if (classId) {
    query += ' AND u.class_id = ?';
    binds.push(classId);
  }
  query += ' ORDER BY u.id DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ students: results });
}
