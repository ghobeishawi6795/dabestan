import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId || !body?.title) return err('assignmentId and title are required');

  const assignment = await env.DB.prepare('SELECT id FROM assignments WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(body.assignmentId, teacher.id, teacher.school_id).first();
  if (!assignment) return err('assignment not found', 404);

  await env.DB.prepare('UPDATE assignments SET title = ?, description = ?, due_at = ? WHERE id = ?')
    .bind(body.title, body.description || null, body.dueAt || null, body.assignmentId).run();

  return json({ ok: true });
}
