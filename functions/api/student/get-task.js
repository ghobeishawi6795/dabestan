import { json, err } from '../_lib/http.js';
import { getStreak } from '../_lib/badges.js';
import { stripAnswerKey } from '../_lib/grading.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const url = new URL(request.url);
  const assignmentId = url.searchParams.get('id');

  // ---------- حالت جزئیات (task.html) — با پشتیبانی pinned_version ----------
  if (assignmentId) {
    if (!student.class_id) return err('no class', 400);

    const assignment = await env.DB.prepare(
      'SELECT id, title, description, due_at FROM assignments WHERE id = ? AND class_id = ? AND school_id = ?'
    ).bind(assignmentId, student.class_id, student.school_id).first();
    if (!assignment) return err('assignment not found', 404);

    const submission = await env.DB.prepare(
      'SELECT id, status, score, excused FROM submissions WHERE assignment_id = ? AND student_id = ?'
    ).bind(assignmentId, student.id).first();

    const { results: rows } = await env.DB.prepare(
      `SELECT aq.position, aq.pinned_version, q.id, q.title, q.question_type, q.content_json, q.custom_html, q.version
       FROM assignment_questions aq JOIN question_bank q ON q.id = aq.question_id
       WHERE aq.assignment_id = ? ORDER BY aq.position ASC`
    ).bind(assignmentId).all();

    const questions = [];
    for (const row of rows) {
      let served = row;
      const pinned = row.pinned_version || row.version || 1;
      // اگه نسخهٔ پین‌شده با نسخهٔ فعلی فرق داره، اسنپ‌شات قدیمی رو سرو می‌کنیم
      if (pinned !== (row.version || 1)) {
        const snap = await env.DB.prepare(
          'SELECT title, content_json, custom_html FROM question_versions WHERE question_id = ? AND version = ?'
        ).bind(row.id, pinned).first();
        if (snap) served = { ...row, title: snap.title, content_json: snap.content_json, custom_html: snap.custom_html };
      }
      questions.push(stripAnswerKey(served));
    }

    return json({ assignment, questions, submission: submission || null });
  }

  // ---------- حالت لیست (student.html loadAll) ----------
  if (!student.class_id) {
    return json({ assignments: [], streak: 0, doneCount: 0, avgScore: null });
  }

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
