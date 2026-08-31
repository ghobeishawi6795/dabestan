import { json, err } from '../_lib/http.js';
import { generateDueSoonReminders } from '../_lib/notify.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  await generateDueSoonReminders(env, student);

  const { results } = await env.DB.prepare(
    `SELECT id, type, title, body, related_id, is_read, created_at
     FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50`
  ).bind(student.id).all();

  const unread = await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0')
    .bind(student.id).first();

  return json({ notifications: results, unreadCount: unread.n });
}
