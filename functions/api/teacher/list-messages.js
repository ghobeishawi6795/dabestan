import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT m.id, m.subject, m.body, m.read_at, m.created_at, u.full_name AS fromName
     FROM messages m JOIN users u ON u.id = m.from_user_id
     WHERE m.to_user_id = ? AND m.school_id = ?
     ORDER BY m.id DESC LIMIT 30`
  ).bind(teacher.id, teacher.school_id).all();

  const unreadCount = results.filter((m) => !m.read_at).length;
  return json({ messages: results, unreadCount });
}
