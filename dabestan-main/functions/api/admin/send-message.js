import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.toUserId || !body?.body) return err('toUserId and body are required');

  const teacher = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'teacher'`)
    .bind(body.toUserId, admin.school_id).first();
  if (!teacher) return err('toUserId does not belong to this school', 400);

  await env.DB.prepare(
    'INSERT INTO messages (school_id, from_user_id, to_user_id, subject, body) VALUES (?, ?, ?, ?, ?)'
  ).bind(admin.school_id, admin.id, teacher.id, body.subject || null, body.body).run();

  return json({ ok: true });
}
