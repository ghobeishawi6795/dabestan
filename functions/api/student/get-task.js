import { json, err } from '../_lib/http.js';
import { stripAnswerKey } from '../_lib/grading.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const url = new URL(request.url);
  const assignmentId = url.searchParams.get('id');
  if (!assignmentId) return err('id query param is required');

  // Ownership check: the assignment must target this student's own class in this student's school.
  const assignment = await env.DB.prepare(
    'SELECT id, title, description, due_at, class_id FROM assignments WHERE id = ? AND school_id = ? AND class_id = ?'
  ).bind(assignmentId, student.school_id, student.class_id).first();
  if (!assignment) return err('assignment not found', 404);

  const { results: questions } = await env.DB.prepare(
    `SELECT q.id, q.question_type, q.title, q.content_json, q.custom_html, aq.position
     FROM assignment_questions aq
     JOIN question_bank q ON q.id = aq.question_id
     WHERE aq.assignment_id = ?
     ORDER BY aq.position ASC`
  ).bind(assignment.id).all();

  const submission = await env.DB.prepare(
    'SELECT status, score FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignment.id, student.id).first();

  return json({
    assignment: { id: assignment.id, title: assignment.title, description: assignment.description, dueAt: assignment.due_at },
    questions: questions.map(stripAnswerKey),
    submission: submission || null,
  });
}
