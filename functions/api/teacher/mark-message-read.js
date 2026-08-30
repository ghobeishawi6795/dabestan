import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.messageId) return err('messageId is required');

  const message = await env.DB.prepare('SELECT id FROM messages WHERE id = ? AND to_user_id = ?')
    .bind(body.messageId, teacher.id).first();
  if (!message) return err('message not found', 404);

  await env.DB.prepare('UPDATE messages SET read_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), body.messageId).run();

  return json({ ok: true });
}
