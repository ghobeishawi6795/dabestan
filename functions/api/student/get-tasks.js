import { json, err } from '../_lib/http.js';
import { getStreak } from '../_lib/badges.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);
  if (!student.class_id) return json({ assignments: [], streak: 0, doneCount: 0, avgScore: null });

  const { results } = await env.DB.prepare(
    `SELECT a.id, a.title, a.due_at, a.created_at,
            sub.status AS submission_status, sub.score, sub.excused,
            (SELECT q.question_type FROM assignment_questions aq JOIN question_bank q ON q.id = aq.question_id
             WHERE aq.assignment_id = a.id ORDER BY aq.position ASC LIMIT 1) AS primary_type
     FROM assignments a
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
     WHERE a.class_id = ? AND a.school_id = ?
     ORDER BY a.id DESC LIMIT 100`
  ).bind(student.id, student.class_id, student.school_id).all();

  const streak = await getStreak(env, student.id);

  const doneRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n, AVG(score) AS avg FROM submissions
     WHERE student_id = ? AND status IN ('submitted','reviewed') AND assignment_id IN (SELECT id FROM assignments WHERE class_id = ?)`
  ).bind(student.id, student.class_id).first();

  return json({
    assignments: results,
    streak,
    doneCount: doneRow.n,
    avgScore: doneRow.avg !== null ? Math.round(doneRow.avg) : null,
  });
}
