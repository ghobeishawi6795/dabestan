import { json, err } from '../_lib/http.js';
import { notify } from '../_lib/notify.js';

const MAX_LEN = 1000;

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.code) return err('code is required');
  if (!body?.body || typeof body.body !== 'string' || !body.body.trim()) return err('message body is required');
  if (body.body.length > MAX_LEN) return err(`message exceeds ${MAX_LEN} characters`);

  const student = await env.DB.prepare(
    `SELECT u.id, u.full_name, c.teacher_id FROM users u LEFT JOIN classes c ON c.id = u.class_id
     WHERE u.parent_code = ? AND u.role = 'student'`
  ).bind(body.code).first();
  if (!student) return err('invalid code', 404);
  if (!student.teacher_id) return err('this student has no assigned teacher yet', 400);

  const row = await env.DB.prepare(
    "INSERT INTO parent_messages (student_id, teacher_id, sender, body) VALUES (?, ?, 'parent', ?) RETURNING id, created_at"
  ).bind(student.id, student.teacher_id, body.body.trim()).first();

  await notify(env, student.teacher_id, 'parent_message', `پیام از والدین ${student.full_name}`, body.body.trim(), row.id);

  return json({ ok: true, id: row.id, createdAt: row.created_at });
}
