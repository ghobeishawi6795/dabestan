import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (user.role !== 'parent' && user.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.studentId || !body?.note) return err('studentId and note required');

  await env.DB.prepare(
    'INSERT INTO parent_notes (student_id, parent_name, note, is_private) VALUES (?, ?, ?, ?)'
  ).bind(body.studentId, body.parentName || 'والدین', body.note, body.isPrivate ? 1 : 0).run();

  return json({ ok: true });
}
