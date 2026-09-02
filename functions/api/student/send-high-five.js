import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.toStudentId) return err('toStudentId required');

  await env.DB.prepare(
    'INSERT INTO high_fives (from_student_id, to_student_id, message) VALUES (?, ?, ?)'
  ).bind(student.id, body.toStudentId, body.message || null).run();

  return json({ ok: true });
}
