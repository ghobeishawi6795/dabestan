import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT sub.id AS submissionId, sub.assignment_id AS assignmentId, a.title AS assignmentTitle,
            u.full_name AS studentName,
            (SELECT q.question_type FROM submission_answers sa JOIN question_bank q ON q.id = sa.question_id
             WHERE sa.submission_id = sub.id AND sa.is_correct IS NULL LIMIT 1) AS pendingType
     FROM submissions sub
     JOIN assignments a ON a.id = sub.assignment_id
     JOIN users u ON u.id = sub.student_id
     WHERE a.teacher_id = ? AND a.school_id = ? AND sub.status = 'submitted'
       AND EXISTS (SELECT 1 FROM submission_answers sa WHERE sa.submission_id = sub.id AND sa.is_correct IS NULL)
     ORDER BY sub.id DESC LIMIT 20`
  ).bind(teacher.id, teacher.school_id).all();

  return json({ pending: results });
}
