import { json, err } from '../_lib/http.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';
import { notify } from '../_lib/notify.js';
import { recordSkillResults } from '../_lib/skill-results.js';

const POINTS_PER_CORRECT = 10;

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;

  if (teacher.role !== 'teacher') {
    return err('forbidden', 403);
  }

  const body = await request.json().catch(() => null);

  if (!body?.submissionId || !Array.isArray(body.manualGrades)) {
    return err(
      'submissionId and manualGrades[] ({answerId, correct}) are required'
    );
  }

  const submissionId = Number(body.submissionId);

  if (!Number.isInteger(submissionId)) {
    return err('submissionId is invalid', 400);
  }

  const submission = await env.DB.prepare(
    `SELECT
       sub.id,
       sub.student_id,
       sub.status,
       a.title AS assignment_title
     FROM submissions sub
     JOIN assignments a
       ON a.id = sub.assignment_id
     WHERE sub.id = ?
       AND a.teacher_id = ?
       AND a.school_id = ?`
  ).bind(
    submissionId,
    teacher.id,
    teacher.school_id
  ).first();

  if (!submission) {
    return err('submission not found', 404);
  }

  const uniqueGrades = new Map();

  for (const grade of body.manualGrades) {
    if (!grade || grade.answerId == null) continue;

    const answerId = Number(grade.answerId);

    if (!Number.isInteger(answerId)) continue;

    uniqueGrades.set(String(answerId), {
      answerId,
      correct: !!grade.correct
    });
  }

  let newlyCorrectCount = 0;

  for (const grade of uniqueGrades.values()) {
    const answer = await env.DB.prepare(
      `SELECT
         sa.id,
         sa.is_correct
       FROM submission_answers sa
       JOIN question_bank q
         ON q.id = sa.question_id
       WHERE sa.id = ?
         AND sa.submission_id = ?
         AND q.school_id = ?
         AND q.teacher_id = ?`
    ).bind(
      grade.answerId,
      submissionId,
      teacher.school_id,
      teacher.id
    ).first();

    if (!answer) continue;

    const nextCorrect = grade.correct ? 1 : 0;

    await env.DB.prepare(
      `UPDATE submission_answers
       SET is_correct = ?
       WHERE id = ?
         AND submission_id = ?`
    ).bind(
      nextCorrect,
      grade.answerId,
      submissionId
    ).run();

    if (
      nextCorrect === 1 &&
      answer.is_correct !== 1
    ) {
      newlyCorrectCount++;
    }
  }

  const { results: allAnswers } = await env.DB.prepare(
    `SELECT is_correct
     FROM submission_answers
     WHERE submission_id = ?`
  ).bind(submissionId).all();

  const total = allAnswers.length;

  if (!total) {
    return err('submission has no answers', 400);
  }

  const unresolved = allAnswers.filter(
    (answer) => answer.is_correct === null
  ).length;

  /*
   * Teacher review is allowed to finish the submission only
   * when no manual answer remains unresolved.
   */
  if (unresolved > 0) {
    return err(
      `هنوز ${unresolved} پاسخ نیاز به تصحیح دارد`,
      400
    );
  }

  const correct = allAnswers.filter(
    (answer) => answer.is_correct === 1
  ).length;

  const finalScore = Math.round(
    (correct / total) * 100
  );

  const wasAlreadyReviewed =
    submission.status === 'reviewed';

  await env.DB.prepare(
    `UPDATE submissions
     SET status = 'reviewed',
         score = ?,
         reviewed_at = ?
     WHERE id = ?`
  ).bind(
    finalScore,
    new Date().toISOString(),
    submissionId
  ).run();

  /*
   * Rebuild skill results after all manual answers have
   * received their final correctness values.
   */
  await recordSkillResults(env, submissionId);

  /*
   * XP is awarded only when the submission moves from
   * submitted -> reviewed for the first time.
   */
  if (
    newlyCorrectCount > 0 &&
    !wasAlreadyReviewed
  ) {
    const points = newlyCorrectCount * POINTS_PER_CORRECT;

    await env.DB.prepare(
      `UPDATE users
       SET growth_points = growth_points + ?
       WHERE id = ?`
    ).bind(
      points,
      submission.student_id
    ).run();
  }

  await notify(
    env,
    submission.student_id,
    'grade_ready',
    'نمره‌ت آماده شد! 🎉',
    submission.assignment_title,
    submissionId
  );

  const newlyEarnedBadges =
    await checkAndAwardTeacherBadges(env, teacher.id);

  return json({
    ok: true,
    submissionId,
    status: 'reviewed',
    finalScore,
    newlyEarnedBadges
  });
}
