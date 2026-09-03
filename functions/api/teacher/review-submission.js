import { json, err } from '../_lib/http.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';
import { notify } from '../_lib/notify.js';

const POINTS_PER_CORRECT = 10;

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.submissionId || !Array.isArray(body.manualGrades)) {
    return err('submissionId and manualGrades[] ({answerId, correct}) are required');
  }

  // Ownership check: the submission's assignment must belong to this teacher.
  const submission = await env.DB.prepare(
    `SELECT sub.id, sub.student_id, sub.status, a.title AS assignment_title FROM submissions sub
     JOIN assignments a ON a.id = sub.assignment_id
     WHERE sub.id = ? AND a.teacher_id = ? AND a.school_id = ?`
  ).bind(body.submissionId, teacher.id, teacher.school_id).first();
  if (!submission) return err('submission not found', 404);

  // هر answerId فقط یک بار پردازش شود.
  // اگر یک answerId چند بار در درخواست آمده باشد، آخرین مقدار آن ملاک است.
  const uniqueGrades = new Map();
  for (const g of body.manualGrades) {
    if (!g || !g.answerId) continue;
    uniqueGrades.set(String(g.answerId), {
      answerId: g.answerId,
      correct: !!g.correct,
    });
  }

  let newlyCorrectCount = 0;
  for (const g of uniqueGrades.values()) {
    const answer = await env.DB.prepare(
      'SELECT id, is_correct FROM submission_answers WHERE id = ? AND submission_id = ?'
    ).bind(g.answerId, body.submissionId).first();

    if (!answer) continue;

    const nextCorrect = g.correct ? 1 : 0;

    await env.DB.prepare(
      'UPDATE submission_answers SET is_correct = ? WHERE id = ? AND submission_id = ?'
    ).bind(nextCorrect, g.answerId, body.submissionId).run();

    if (nextCorrect === 1 && answer.is_correct !== 1) {
      newlyCorrectCount++;
    }
  }

  const { results: allAnswers } = await env.DB.prepare(
    'SELECT is_correct FROM submission_answers WHERE submission_id = ?'
  ).bind(body.submissionId).all();
  const total = allAnswers.length;
  const correct = allAnswers.filter((a) => a.is_correct === 1).length;
  const finalScore = total > 0 ? Math.round((correct / total) * 100) : null;

  await env.DB.prepare(`UPDATE submissions SET status = 'reviewed', score = ?, reviewed_at = ? WHERE id = ?`)
    .bind(finalScore, new Date().toISOString(), body.submissionId).run();

  // XP فقط در اولین review داده می‌شود؛
  // ارسال دوباره همان submission نباید XP را دوباره اعطا کند.
  if (newlyCorrectCount > 0 && submission.status !== 'reviewed') {
    const pts = newlyCorrectCount * POINTS_PER_CORRECT;
    await env.DB.prepare('UPDATE users SET growth_points = growth_points + ? WHERE id = ?')
      .bind(pts, submission.student_id).run();
  }

  await notify(env, submission.student_id, 'grade_ready', 'نمره‌ت آماده شد! 🎉', submission.assignment_title, body.submissionId);

  const newlyEarnedBadges = await checkAndAwardTeacherBadges(env, teacher.id);
  return json({ ok: true, finalScore, newlyEarnedBadges });
}
