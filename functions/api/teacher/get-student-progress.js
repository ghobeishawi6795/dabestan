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
    `SELECT sub.score, sub.reviewed_at, a.title
     FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE sub.student_id = ? AND sub.status = 'reviewed' AND sub.score IS NOT NULL
     ORDER BY sub.reviewed_at ASC LIMIT 60`
  ).bind(studentId).all();

  return json({ studentName: student.full_name, history: results.map((r) => ({ score: r.score, date: r.reviewed_at, title: r.title })) });
}
