import { json, err } from '../_lib/http.js';
import { gradeAnswer } from '../_lib/grading.js';
import { checkAndAwardBadges } from '../_lib/badges.js';

const POINTS_PER_CORRECT = 10;
const POINTS_PER_MANUAL_SUBMISSION = 5; // participation points for drawing/audio/photo/coloring, pending teacher review

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId || !Array.isArray(body.answers)) {
    return err('assignmentId and answers[] are required');
  }
  const { assignmentId, answers } = body;

  const assignment = await env.DB.prepare(
    'SELECT id FROM assignments WHERE id = ? AND school_id = ? AND class_id = ?'
  ).bind(assignmentId, student.school_id, student.class_id).first();
  if (!assignment) return err('assignment not found', 404);

  const existing = await env.DB.prepare(
    'SELECT id, status FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignmentId, student.id).first();
  if (existing?.status === 'reviewed') return err('this assignment was already reviewed and cannot be resubmitted', 409);

  // ⭐ اصلاح: امتیاز/سکه فقط برای اولین ارسال — جلوگیری از مزرعهٔ سکه با ارسال مجدد
  const firstTime = !existing;

  // Only grade against questions that actually belong to this assignment
  const { results: linkedQuestions } = await env.DB.prepare(
    `SELECT q.id, q.question_type, q.content_json
     FROM assignment_questions aq JOIN question_bank q ON q.id = aq.question_id
     WHERE aq.assignment_id = ?`
  ).bind(assignmentId).all();
  const questionById = new Map(linkedQuestions.map((q) => [q.id, q]));

  // Require every linked question to be answered before allowing submission
  const answerByQid = new Map(answers.map((a) => [a.questionId, a.answer]));
  for (const q of linkedQuestions) {
    if (!answerByQid.has(q.id)) return err(`missing answer for question ${q.id}`, 400);
  }

  let correctCount = 0;
  let autoGradableCount = 0;
  let manualCount = 0;
  const gradedRows = [];

  for (const [qid, answer] of answerByQid.entries()) {
    const question = questionById.get(qid);
    if (!question) continue; // silently drop answers for questions not in this assignment
    const result = gradeAnswer(question, answer);
    if (result.error) return err(`${result.error} for question ${qid}`, 400);
    if (result.autoGraded) {
      autoGradableCount++;
      if (result.correct) correctCount++;
    } else {
      manualCount++;
    }
    gradedRows.push({ questionId: qid, answer, isCorrect: result.autoGraded ? (result.correct ? 1 : 0) : null });
  }

  const score = autoGradableCount > 0 ? Math.round((correctCount / autoGradableCount) * 100) : null;
  const now = new Date().toISOString();

  let submissionId;
  if (existing) {
    submissionId = existing.id;
    await env.DB.prepare('UPDATE submissions SET status = ?, score = ?, submitted_at = ? WHERE id = ?')
      .bind('submitted', score, now, submissionId).run();
    await env.DB.prepare('DELETE FROM submission_answers WHERE submission_id = ?').bind(submissionId).run();
  } else {
    const inserted = await env.DB.prepare(
      `INSERT INTO submissions (assignment_id, student_id, status, score, submitted_at)
       VALUES (?, ?, 'submitted', ?, ?) RETURNING id`
    ).bind(assignmentId, student.id, score, now).first();
    submissionId = inserted.id;
  }

  const answerInserts = gradedRows.map((r) =>
    env.DB.prepare(
      'INSERT INTO submission_answers (submission_id, question_id, answer_json, is_correct) VALUES (?, ?, ?, ?)'
    ).bind(submissionId, r.questionId, JSON.stringify(r.answer), r.isCorrect)
  );
  await env.DB.batch(answerInserts);

  let pointsEarned = 0;
  if (firstTime) {
    pointsEarned = correctCount * POINTS_PER_CORRECT + manualCount * POINTS_PER_MANUAL_SUBMISSION;
    // سکه هم به همون نرخ امتیاز رشد اضافه می‌شه — ولی جدا نگه داشته می‌شه چون خرج‌شدنی توی فروشگاهه
    await env.DB.prepare('UPDATE users SET growth_points = growth_points + ?, coins = coins + ? WHERE id = ?')
      .bind(pointsEarned, pointsEarned, student.id).run();

    // تغذیهٔ حیوان خانگی (اگر دانش‌آموز قبلاً یکی انتخاب کرده باشه) — هر ارسال موفق = یک وعده غذا.
    await env.DB.prepare('UPDATE pets SET last_fed_at = ? WHERE student_id = ?')
      .bind(now, student.id).run();
  }

  const updatedUser = await env.DB.prepare('SELECT growth_points, coins FROM users WHERE id = ?').bind(student.id).first();
  const newlyEarnedBadges = await checkAndAwardBadges(env, student.id);

  return json({ ok: true, score, pointsEarned, growthPoints: updatedUser.growth_points, coins: updatedUser.coins, newlyEarnedBadges });
}
