import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const studentId = Number(url.searchParams.get('studentId'));
  if (!studentId) return err('studentId is required');

  const student = await env.DB.prepare(
    `SELECT s.id, s.full_name FROM users s JOIN classes c ON c.id = s.class_id
     WHERE s.id = ? AND c.teacher_id = ? AND s.role = 'student'`
  ).bind(studentId, teacher.id).first();
  if (!student) return err('student not found', 404);

  const { results } = await env.DB.prepare(
    'SELECT id, sender, body, created_at FROM parent_messages WHERE student_id = ? AND teacher_id = ? ORDER BY id ASC LIMIT 100'
  ).bind(studentId, teacher.id).all();

  await env.DB.prepare(
    `UPDATE parent_messages SET is_read = 1 WHERE student_id = ? AND teacher_id = ? AND sender = 'parent' AND is_read = 0`
  ).bind(studentId, teacher.id).run();

  return json({ studentName: student.full_name, messages: results });
}
