import { json, err } from '../_lib/http.js';
import { gradeAnswer } from '../_lib/grading.js';
import { checkAndAwardBadges } from '../_lib/badges.js';
import { notify } from '../_lib/notify.js';
import { recordSkillResults } from '../_lib/skill-results.js';

const POINTS_PER_CORRECT = 10;
const POINTS_PER_MANUAL_SUBMISSION = 5;

export async function onRequestPost({ request, env, data }) {
  const student = data.user;

  if (student.role !== 'student') {
    return err('forbidden', 403);
  }

  const body = await request.json().catch(() => null);

  if (!body?.assignmentId || !Array.isArray(body.answers)) {
    return err('assignmentId and answers[] are required');
  }

  const assignmentId = Number(body.assignmentId);
  const answers = body.answers;

  if (!Number.isInteger(assignmentId)) {
    return err('assignmentId is invalid', 400);
  }

  const assignment = await env.DB.prepare(
    `SELECT id, due_at
     FROM assignments
     WHERE id = ?
       AND school_id = ?
       AND class_id = ?`
  ).bind(
    assignmentId,
    student.school_id,
    student.class_id
  ).first();

  if (!assignment) {
    return err('assignment not found', 404);
  }

  if (assignment.due_at) {
    const dueAt = new Date(assignment.due_at);

    if (!Number.isNaN(dueAt.getTime()) && new Date() > dueAt) {
      return err('این تکلیف به پایان رسیده است', 400);
    }
  }

  const existing = await env.DB.prepare(
    `SELECT id, status
     FROM submissions
     WHERE assignment_id = ?
       AND student_id = ?`
  ).bind(
    assignmentId,
    student.id
  ).first();

  if (existing?.status === 'reviewed') {
    return err(
      'this assignment was already reviewed and cannot be resubmitted',
      409
    );
  }

  const firstTime = !existing;

  const { results: linkedQuestions } = await env.DB.prepare(
    `SELECT
       q.id,
       q.question_type,
       q.content_json
     FROM assignment_questions aq
     JOIN question_bank q
       ON q.id = aq.question_id
     WHERE aq.assignment_id = ?
     ORDER BY aq.id ASC`
  ).bind(assignmentId).all();

  if (!linkedQuestions.length) {
    return err('این تکلیف هنوز سؤالی ندارد', 400);
  }

  const questionById = new Map(
    linkedQuestions.map((q) => [Number(q.id), q])
  );

  const answerByQid = new Map();

  for (const item of answers) {
    if (!item || item.questionId == null) continue;

    const questionId = Number(item.questionId);

    if (!Number.isInteger(questionId)) continue;

    answerByQid.set(questionId, item.answer);
  }

  for (const question of linkedQuestions) {
    if (!answerByQid.has(Number(question.id))) {
      return err(
        `missing answer for question ${question.id}`,
        400
      );
    }
  }

  let correctCount = 0;
  let autoGradableCount = 0;
  let manualCount = 0;

  const gradedRows = [];

  for (const [questionId, answer] of answerByQid.entries()) {
    const question = questionById.get(questionId);

    if (!question) {
      continue;
    }

    let result;

    try {
      result = gradeAnswer(question, answer);
    } catch (e) {
      console.error('grading error:', e);
      return err(
        `invalid answer for question ${questionId}`,
        400
      );
    }

    if (result.error) {
      return err(
        `${result.error} for question ${questionId}`,
        400
      );
    }

    if (result.autoGraded) {
      autoGradableCount++;

      if (result.correct) {
        correctCount++;
      }
    } else {
      manualCount++;
    }

    gradedRows.push({
      questionId,
      answer,
      isCorrect: result.autoGraded
        ? (result.correct ? 1 : 0)
        : null
    });
  }

  if (!gradedRows.length) {
    return err('no valid answers were submitted', 400);
  }

  const score = autoGradableCount > 0
    ? Math.round((correctCount / autoGradableCount) * 100)
    : null;

  const now = new Date().toISOString();

  let submissionId;

  if (existing) {
    submissionId = existing.id;

    await env.DB.prepare(
      `UPDATE submissions
       SET status = 'submitted',
           score = ?,
           submitted_at = ?,
           reviewed_at = NULL
       WHERE id = ?`
    ).bind(
      score,
      now,
      submissionId
    ).run();

    await env.DB.prepare(
      `DELETE FROM submission_answers
       WHERE submission_id = ?`
    ).bind(submissionId).run();

    await env.DB.prepare(
      `DELETE FROM student_skill_results
       WHERE submission_id = ?`
    ).bind(submissionId).run();

  } else {
    const inserted = await env.DB.prepare(
      `INSERT INTO submissions
       (assignment_id, student_id, status, score, submitted_at)
       VALUES (?, ?, 'submitted', ?, ?)
       RETURNING id`
    ).bind(
      assignmentId,
      student.id,
      score,
      now
    ).first();

    submissionId = inserted.id;
  }

  const answerInserts = gradedRows.map((row) =>
    env.DB.prepare(
      `INSERT INTO submission_answers
       (submission_id, question_id, answer_json, is_correct)
       VALUES (?, ?, ?, ?)`
    ).bind(
      submissionId,
      row.questionId,
      JSON.stringify(row.answer),
      row.isCorrect
    )
  );

  await env.DB.batch(answerInserts);

  /*
   * Skill results are recorded here only for answers that
   * already have an objective correctness value.
   * Manual answers will be refreshed after teacher review.
   */
  await recordSkillResults(env, submissionId);

  let pointsEarned = 0;

  if (firstTime) {
    pointsEarned =
      correctCount * POINTS_PER_CORRECT +
      manualCount * POINTS_PER_MANUAL_SUBMISSION;

    await env.DB.prepare(
      `UPDATE users
       SET growth_points = growth_points + ?
       WHERE id = ?`
    ).bind(
      pointsEarned,
      student.id
    ).run();
  }

  const updatedUser = await env.DB.prepare(
    `SELECT growth_points
     FROM users
     WHERE id = ?`
  ).bind(student.id).first();

  const newlyEarnedBadges =
    await checkAndAwardBadges(env, student.id);

  // اعلان نشان‌های تازه کسب‌شده
  for (const badge of newlyEarnedBadges || []) {
    const badgeTitle =
      badge?.name ||
      badge?.title ||
      badge?.badge_name ||
      badge?.code ||
      'نشان جدید';

    await notify(
      env,
      student.id,
      'badge_earned',
      'نشان جدید گرفتی 🏅',
      String(badgeTitle),
      badge?.id ?? null
    );
  }

  return json({
    ok: true,
    submissionId,
    status: 'submitted',
    score,
    autoGradableCount,
    correctCount,
    manualCount,
    pointsEarned,
    growthPoints: Number(updatedUser?.growth_points || 0),
    newlyEarnedBadges
  });
}
