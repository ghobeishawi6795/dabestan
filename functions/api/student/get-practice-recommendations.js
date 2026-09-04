import { json, err } from '../_lib/http.js';
import { stripAnswerKey } from '../_lib/grading.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export async function onRequestGet({ request, env, data }) {
  const student = data.user;

  if (!student || student.role !== 'student') {
    return err('forbidden', 403);
  }

  const url = new URL(request.url);

  const requestedLimit = Number(url.searchParams.get('limit') || 10);
  const requestedSkillId = Number(url.searchParams.get('skill_id') || 0);
  const limit = clamp(
    Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 10,
    1,
    20
  );

  /*
   * 1) پیدا کردن مهارت‌های شروع‌شده و ضعیف.
   *
   * mastery:
   * < 60  => needs_support
   * < 80  => developing
   * >= 80 => mastered
   *
   * فقط مهارت‌هایی که حداقل یک پاسخ دارند وارد پیشنهاد می‌شوند.
   */
  const { results: weakSkills } = await env.DB.prepare(
    `SELECT
       ls.id,
       ls.subject,
       ls.grade,
       ls.code,
       ls.name,
       ls.description,
       COALESCE(SUM(ssr.correct_count), 0) AS correct_count,
       COALESCE(SUM(ssr.answer_count), 0) AS answer_count,
       CASE
         WHEN COALESCE(SUM(ssr.answer_count), 0) = 0 THEN 0
         ELSE ROUND(
           COALESCE(SUM(ssr.correct_count), 0) * 100.0 /
           SUM(ssr.answer_count)
         )
       END AS mastery
     FROM learning_skills ls
     LEFT JOIN student_skill_results ssr
       ON ssr.skill_id = ls.id
      AND ssr.student_id = ?
     WHERE ls.school_id = ?
       AND ls.is_active = 1
     GROUP BY
       ls.id,
       ls.subject,
       ls.grade,
       ls.code,
       ls.name,
       ls.description
     HAVING COALESCE(SUM(ssr.answer_count), 0) > 0
        AND (
          COALESCE(SUM(ssr.correct_count), 0) * 100.0 /
          COALESCE(SUM(ssr.answer_count), 1)
        ) < 80
       AND (
         ? = 0 OR ls.id = ?
       )
     ORDER BY
       mastery ASC,
       answer_count DESC,
       ls.position ASC,
       ls.id ASC
     LIMIT 30`
  ).bind(student.id, student.school_id).all();

  /*
   * 2) اگر هنوز هیچ مهارتی شروع نشده، پیشنهاد مهارتی نداریم.
   *
   * این حالت را جدا نگه می‌داریم تا UI بتواند پیام مناسبی نشان دهد.
   */
  if (!weakSkills.length) {
    return json({
      ok: true,
      recommendations: [],
      weakSkills: [],
      meta: {
        limit,
        skillId: requestedSkillId || null,
        reason: 'no_weak_started_skills',
      },
    });
  }

  /*
   * 3) سؤال‌های متصل به مهارت‌های ضعیف را می‌گیریم.
   *
   * question_bank:
   * - سؤال باید فعال باشد.
   * - سؤال باید متعلق به همین مدرسه باشد.
   *
   * مالکیت سؤال را بر اساس teacher_id محدود نمی‌کنیم؛
   * چون دانش‌آموز می‌تواند از سؤال‌های مشترک/منتشرشده استفاده کند.
   */
  const skillIds = weakSkills.map((skill) => Number(skill.id));

  const placeholders = skillIds.map(() => '?').join(',');

  const { results: questionRows } = await env.DB.prepare(
    `SELECT
       q.id,
       q.title,
       q.question_type,
       q.content_json,
       q.custom_html,
       q.version,
       qs.skill_id,
       qs.weight,
       ls.subject,
       ls.grade,
       ls.code AS skill_code,
       ls.name AS skill_name
     FROM question_skills qs
     JOIN learning_skills ls
       ON ls.id = qs.skill_id
     JOIN question_bank q
       ON q.id = qs.question_id
     WHERE qs.skill_id IN (${placeholders})
       AND ls.school_id = ?
       AND ls.is_active = 1
     ORDER BY
       qs.weight DESC,
       q.id DESC`
  ).bind(...skillIds, student.school_id).all();

  /*
   * 4) سؤال‌هایی که قبلاً در submissionهای دانش‌آموز دیده شده‌اند
   * را جمع می‌کنیم تا پیشنهادها تکراری نباشند.
   *
   * اگر submission_answers.question_id وجود داشته باشد،
   * سؤال را قبلاً پاسخ داده‌شده در نظر می‌گیریم.
   */
  const { results: answeredRows } = await env.DB.prepare(
    `SELECT DISTINCT sa.question_id
     FROM submission_answers sa
     JOIN submissions s
       ON s.id = sa.submission_id
     WHERE s.student_id = ?
     LIMIT 5000`
  ).bind(student.id).all();

  const answeredIds = new Set(
    answeredRows.map((row) => Number(row.question_id))
  );

  /*
   * 5) امتیازدهی سؤال:
   *
   * ضعف بیشتر = امتیاز بیشتر
   * وزن ارتباط سؤال با مهارت = امتیاز بیشتر
   * سؤال پاسخ‌داده‌نشده = ترجیح بیشتر
   */
  const skillMap = new Map(
    weakSkills.map((skill) => [
      Number(skill.id),
      {
        ...skill,
        mastery: Number(skill.mastery || 0),
        answerCount: Number(skill.answer_count || 0),
      },
    ])
  );

  const candidates = [];

  for (const row of questionRows) {
    const questionId = Number(row.id);
    const skillId = Number(row.skill_id);

    const skill = skillMap.get(skillId);

    if (!skill) continue;

    /*
     * فعلاً سؤال‌های قبلاً پاسخ‌داده‌شده را حذف می‌کنیم.
     * این باعث می‌شود پیشنهادها واقعاً جدید باشند.
     */
    if (answeredIds.has(questionId)) continue;

    const mastery = Number(skill.mastery || 0);
    const weakness = 100 - mastery;
    const weight = Number(row.weight || 1);

    const priority =
      weakness * 10 +
      weight * 5 +
      (skill.answerCount > 0 ? 2 : 0);

    candidates.push({
      question: row,
      skill,
      priority,
    });
  }

  /*
   * 6) مرتب‌سازی نهایی.
   */
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    if (Number(a.skill.mastery) !== Number(b.skill.mastery)) {
      return Number(a.skill.mastery) - Number(b.skill.mastery);
    }

    return Number(a.question.id) - Number(b.question.id);
  });

  /*
   * 7) جلوگیری از تکرار یک سؤال.
   */
  const seenQuestions = new Set();
  const recommendations = [];

  for (const candidate of candidates) {
    const q = candidate.question;

    if (seenQuestions.has(Number(q.id))) continue;

    seenQuestions.add(Number(q.id));

    const safeQuestion = stripAnswerKey({
      id: q.id,
      title: q.title,
      question_type: q.question_type,
      content_json: q.content_json,
      custom_html: q.custom_html,
      version: q.version,
    });

    recommendations.push({
      question: safeQuestion,
      skill: {
        id: candidate.skill.id,
        subject: candidate.skill.subject,
        grade: candidate.skill.grade,
        code: candidate.skill.code,
        name: candidate.skill.name,
        description: candidate.skill.description,
        mastery: candidate.skill.mastery,
        answerCount: candidate.skill.answerCount,
        status:
          candidate.skill.mastery < 60
            ? 'needs_support'
            : 'developing',
      },
      priority: Math.round(candidate.priority),
    });

    if (recommendations.length >= limit) break;
  }

  /*
   * 8) خلاصه مهارت‌های ضعیف.
   */
  const normalizedWeakSkills = weakSkills.map((skill) => {
    const mastery = Number(skill.mastery || 0);
    const answerCount = Number(skill.answer_count || 0);

    return {
      id: skill.id,
      subject: skill.subject,
      grade: skill.grade,
      code: skill.code,
      name: skill.name,
      description: skill.description,
      mastery,
      answerCount,
      status: mastery < 60 ? 'needs_support' : 'developing',
    };
  });

  return json({
    ok: true,
    recommendations,
    weakSkills: normalizedWeakSkills,
    meta: {
      limit,
      skillId: requestedSkillId || null,
      candidateCount: candidates.length,
      recommendationCount: recommendations.length,
      reason: recommendations.length
        ? 'weak_skills_found'
        : 'no_new_questions',
    },
  });
}
