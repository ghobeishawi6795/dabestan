import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const assignmentId = url.searchParams.get('assignmentId');
  if (!assignmentId) return err('assignmentId query param is required');

  const assignment = await env.DB.prepare('SELECT id, title FROM assignments WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(assignmentId, teacher.id, teacher.school_id).first();
  if (!assignment) return err('assignment not found', 404);

  const { results: submissions } = await env.DB.prepare(
    `SELECT sub.id, sub.status, sub.score, sub.submitted_at, u.full_name AS student_name
     FROM submissions sub JOIN users u ON u.id = sub.student_id
     WHERE sub.assignment_id = ? ORDER BY sub.id DESC`
  ).bind(assignmentId).all();

  for (const sub of submissions) {
    const { results: answers } = await env.DB.prepare(
      `SELECT sa.id, sa.question_id, sa.answer_json, sa.is_correct, q.question_type, q.title
       FROM submission_answers sa JOIN question_bank q ON q.id = sa.question_id
       WHERE sa.submission_id = ?`
    ).bind(sub.id).all();
    sub.answers = answers;
  }

  return json({ assignmentTitle: assignment.title, submissions });
}
