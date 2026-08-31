import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const parentCode = url.searchParams.get('code');
  if (!parentCode) return err('code query param is required');

  const student = await env.DB.prepare(
    `SELECT u.id, c.teacher_id FROM users u LEFT JOIN classes c ON c.id = u.class_id
     WHERE u.parent_code = ? AND u.role = 'student'`
  ).bind(parentCode).first();
  if (!student) return err('invalid code', 404);
  if (!student.teacher_id) return json({ teacherName: null, messages: [] });

  const teacher = await env.DB.prepare('SELECT full_name FROM users WHERE id = ?').bind(student.teacher_id).first();
  const { results } = await env.DB.prepare(
    'SELECT id, sender, body, created_at FROM parent_messages WHERE student_id = ? AND teacher_id = ? ORDER BY id ASC LIMIT 100'
  ).bind(student.id, student.teacher_id).all();

  // خوندن پیام‌ها هم اینجا انجام می‌شه (سمت معلم علامت‌گذاری می‌شن)
  await env.DB.prepare(
    `UPDATE parent_messages SET is_read = 1 WHERE student_id = ? AND teacher_id = ? AND sender = 'teacher' AND is_read = 0`
  ).bind(student.id, student.teacher_id).run();

  return json({ teacherName: teacher?.full_name || null, messages: results });
}
