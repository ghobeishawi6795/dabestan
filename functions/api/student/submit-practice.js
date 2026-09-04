import { json, err } from '../_lib/http.js';
import { gradeAnswer } from '../_lib/grading.js';
import { recordSkillResults } from '../_lib/skill-results.js';

const MAX_ANSWERS = 20;

export async function onRequestPost({ request, env, data }) {
  const student = data.user;

  if (!student || student.role !== 'student') {
    return err('forbidden', 403);
  }

  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.answers)) {
    return err('answers[] is required', 400);
  }

  if (body.answers.length < 1) {
    return err('at least one answer is required', 400);
  }

  if (body.answers.length > MAX_ANSWERS) {
    return err(`maximum ${MAX_ANSWERS} answers allowed`, 400);
  }

  const answerByQuestion = new Map();

  for (const item of body.answers) {
    if (!item || item.questionId == null) continue;

    const questionId = Number(item.questionId);

    if (!Number.isInteger(questionId) || questionId <= 0) {
      continue;
    }

    answerByQuestion.set(questionId, item.answer);
  }

  if (!answerByQuestion.size) {
    return err('no valid answers were submitted', 400);
  }

  const questionIds = [...answerByQuestion.keys()];
  const placeholders = questionIds.map(() => '?').join(',');

  /*
   * فقط سؤال‌هایی پذیرفته می‌شوند که:
   * 1) در question_bank وجود داشته باشند
   * 2) به یک learning skill متصل باشند
   * 3) آن skill متعلق به مدرسه همین دانش‌آموز باشد
   * 4) skill فعال باشد
   */
  const { results: questions } = await env.DB.prepare(
    `SELECT DISTINCT
       q.id,
       q.title,
       q.question_type,
       q.content_json,
       q.custom_html,
       q.version
     FROM question_bank q
     JOIN question_skills qs
       ON qs.question_id = q.id
     JOIN learning_skills ls
       ON ls.id = qs.skill_id
     WHERE q.id IN (${placeholders})
       AND ls.school_id = ?
       AND ls.is_active = 1`
  ).bind(...questionIds, student.school_id).all();

  if (!questions.length) {
    return err('practice questions not found', 404);
  }

  const questionById = new Map(
    questions.map((question) => [Number(question.id), question])
  );

  let correctCount = 0;
  let autoGradableCount = 0;
  let manualCount = 0;

  const gradedRows = [];

  for (const [questionId, answer] of answerByQuestion.entries()) {
    const question = questionById.get(questionId);

    if (!question) {
      continue;
    }

    let result;

    try {
      result = gradeAnswer(question, answer);
    } catch (e) {
      console.error('practice grading error:', e);
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
        : null,
    });
  }

  if (!gradedRows.length) {
    return err('no valid practice answers were submitted', 400);
  }

  const score =
    autoGradableCount > 0
      ? Math.round((correctCount / autoGradableCount) * 100)
      : null;

  const now = new Date().toISOString();

  /*
   * تمرین هوشمند assignment ندارد.
   * submission برای نگهداری نتیجه و اتصال آن به
   * student_skill_results ساخته می‌شود.
   */
  const inserted = await env.DB.prepare(
    `INSERT INTO submissions
       (assignment_id, student_id, status, score, submitted_at)
     VALUES (NULL, ?, 'submitted', ?, ?)
     RETURNING id`
  ).bind(
    student.id,
    score,
    now
  ).first();

  if (!inserted?.id) {
    return err('could not create practice submission', 500);
  }

  const submissionId = Number(inserted.id);

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
   * همان موتور موجود پروژه:
   * submission_answers -> student_skill_results
   */
  await recordSkillResults(env, submissionId);

  return json({
    ok: true,
    submissionId,
    status: 'submitted',
    score,
    correctCount,
    autoGradableCount,
    manualCount,
    answerCount: gradedRows.length,
  });
}
