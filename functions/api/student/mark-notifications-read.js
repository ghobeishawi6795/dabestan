import { json, err } from '../_lib/http.js';

export async function onRequestPost({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').bind(student.id).run();
  return json({ ok: true });
}
