import { json, err } from '../_lib/http.js';

// عمداً بدون رمز — دسترسی با همون parent_code کنترل می‌شه (مثل submit-feedback.js)
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.code || !body?.note) return err('code and note required');
  const note = body.note.toString().trim().slice(0, 500);
  if (!note) return err('note is empty');

  const student = await env.DB.prepare(`SELECT id FROM users WHERE parent_code = ? AND role = 'student'`)
    .bind(body.code).first();
  if (!student) return err('invalid code', 404);

  const parentName = (body.parentName || 'والدین').toString().slice(0, 60);

  await env.DB.prepare(
    'INSERT INTO parent_notes (student_id, parent_name, note, is_private) VALUES (?, ?, ?, ?)'
  ).bind(student.id, parentName, note, body.isPrivate ? 1 : 0).run();

  return json({ ok: true });
}
