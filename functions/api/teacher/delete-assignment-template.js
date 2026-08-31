import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.templateId) return err('templateId is required');

  const t = await env.DB.prepare('SELECT id FROM assignment_templates WHERE id = ? AND teacher_id = ?')
    .bind(body.templateId, teacher.id).first();
  if (!t) return err('template not found', 404);

  await env.DB.prepare('DELETE FROM assignment_templates WHERE id = ?').bind(body.templateId).run();
  return json({ ok: true });
}
