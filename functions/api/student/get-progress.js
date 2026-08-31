import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT s.score, s.reviewed_at, a.title
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE s.student_id = ? AND s.status = 'reviewed' AND s.score IS NOT NULL
     ORDER BY s.reviewed_at ASC LIMIT 60`
  ).bind(student.id).all();

  return json({ history: results.map((r) => ({ score: r.score, date: r.reviewed_at, title: r.title })) });
}
