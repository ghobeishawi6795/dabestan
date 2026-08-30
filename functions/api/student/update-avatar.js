import { json, err } from '../_lib/http.js';

const ALLOWED_AVATARS = ['🦊', '🐼', '🐱', '🐶', '🐰', '🦁', '🐯', '🐨'];

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.avatar || !ALLOWED_AVATARS.includes(body.avatar)) return err('avatar must be one of the allowed set');

  await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(body.avatar, student.id).run();
  return json({ ok: true, avatar: body.avatar });
}
