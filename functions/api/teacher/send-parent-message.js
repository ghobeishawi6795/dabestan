import { json, err } from '../_lib/http.js';

const MAX_LEN = 1000;

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.studentId) return err('studentId is required');
  if (!body?.body || typeof body.body !== 'string' || !body.body.trim()) return err('message body is required');
  if (body.body.length > MAX_LEN) return err(`message exceeds ${MAX_LEN} characters`);

  const student = await env.DB.prepare(
    `SELECT s.id FROM users s JOIN classes c ON c.id = s.class_id
     WHERE s.id = ? AND c.teacher_id = ? AND s.role = 'student'`
  ).bind(body.studentId, teacher.id).first();
  if (!student) return err('student not found', 404);

  const row = await env.DB.prepare(
    "INSERT INTO parent_messages (student_id, teacher_id, sender, body) VALUES (?, ?, 'teacher', ?) RETURNING id, created_at"
  ).bind(body.studentId, teacher.id, body.body.trim()).first();

  return json({ ok: true, id: row.id, createdAt: row.created_at });
}
