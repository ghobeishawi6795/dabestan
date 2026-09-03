import { json, err } from '../_lib/http.js';

function getMasteryStatus(percent, answerCount) {
  if (!answerCount || answerCount <= 0) return 'not_started';
  if (percent < 60) return 'needs_support';
  if (percent < 80) return 'developing';
  return 'mastered';
}

function getStatusLabel(status) {
  switch (status) {
    case 'mastered':
      return 'مسلط';
    case 'developing':
      return 'در حال یادگیری';
    case 'needs_support':
      return 'نیازمند حمایت';
    default:
      return 'شروع نشده';
  }
}

export async function onRequestGet({ request, env }) {
  const teacher = request.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('teacher access required', 403);
  }

  const url = new URL(request.url);
  const studentId = Number(url.searchParams.get('student_id'));

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return err('student_id is required');
  }

  const student = await env.DB.prepare(`
    SELECT
      u.id,
      u.full_name,
      u.class_id,
      c.name AS class_name,
      c.grade
    FROM users u
    LEFT JOIN classes c ON c.id = u.class_id
    WHERE
      u.id = ?
      AND u.role = 'student'
      AND u.school_id = ?
  `).bind(studentId, teacher.school_id).first();

  if (!student) {
    return err('student not found', 404);
  }

  if (!student.class_id) {
    return err('student has no class', 400);
  }

  const teacherClass = await env.DB.prepare(`
    SELECT id
    FROM classes
    WHERE id = ?
      AND teacher_id = ?
      AND school_id = ?
  `).bind(
    student.class_id,
    teacher.id,
    teacher.school_id
  ).first();

  if (!teacherClass) {
    return err('student is not in your class', 403);
  }

  /*
   * فقط آخرین پاسخ هر سؤال در هر submission را نگه می‌داریم.
   *
   * سپس فقط پاسخ‌هایی را حساب می‌کنیم که:
   * - submission بررسی شده باشد
   * - پاسخ واقعاً grading شده باشد
   * - سؤال به skill وصل باشد
   */
  const { results } = await env.DB.prepare(`
    WITH latest_answers AS (
      SELECT
        sa.id,
        sa.submission_id,
        sa.question_id,
        sa.is_correct,
        ROW_NUMBER() OVER (
          PARTITION BY sa.submission_id, sa.question_id
          ORDER BY sa.id DESC
        ) AS rn
      FROM submission_answers sa
    ),

    skill_answers AS (
      SELECT DISTINCT
        s.id AS submission_id,
        la.question_id,
        qs.skill_id,
        qs.weight,
        la.is_correct
      FROM latest_answers la
      INNER JOIN submissions s
        ON s.id = la.submission_id
      INNER JOIN assignments a
        ON a.id = s.assignment_id
      INNER JOIN assignment_questions aq
        ON aq.assignment_id = a.id
       AND aq.question_id = la.question_id
      INNER JOIN question_skills qs
        ON qs.question_id = la.question_id
      INNER JOIN learning_skills ls
        ON ls.id = qs.skill_id
       AND ls.is_active = 1
       AND ls.school_id = ?
      WHERE
        la.rn = 1
        AND s.student_id = ?
        AND s.status = 'reviewed'
        AND s.excused = 0
        AND a.teacher_id = ?
        AND a.school_id = ?
        AND la.is_correct IS NOT NULL
    ),

    aggregated AS (
      SELECT
        skill_id,
        COUNT(*) AS answer_count,
        SUM(weight) AS total_weight,
        SUM(
          CASE
            WHEN is_correct = 1 THEN weight
            ELSE 0
          END
        ) AS correct_weight
      FROM skill_answers
      GROUP BY skill_id
    )

    SELECT
      ls.id,
      ls.subject,
      ls.grade,
      ls.code,
      ls.name,
      ls.description,
      ls.parent_id,
      ls.position,

      COALESCE(ag.answer_count, 0) AS answer_count,
      COALESCE(ag.total_weight, 0) AS total_weight,
      COALESCE(ag.correct_weight, 0) AS correct_weight,

      CASE
        WHEN COALESCE(ag.total_weight, 0) > 0
        THEN ROUND(
          (ag.correct_weight * 100.0) / ag.total_weight,
          1
        )
        ELSE 0
      END AS mastery_percent

    FROM learning_skills ls
    LEFT JOIN aggregated ag
      ON ag.skill_id = ls.id

    WHERE
      ls.school_id = ?
      AND ls.is_active = 1

    ORDER BY
      ls.subject ASC,
      ls.grade ASC,
      ls.parent_id ASC,
      ls.position ASC,
      ls.id ASC
  `).bind(
    teacher.school_id,
    studentId,
    teacher.id,
    teacher.school_id,
    teacher.school_id
  ).all();

  const skills = results.map((row) => {
    const mastery = Number(row.mastery_percent || 0);
    const answerCount = Number(row.answer_count || 0);
    const status = getMasteryStatus(mastery, answerCount);

    return {
      id: row.id,
      subject: row.subject,
      grade: row.grade,
      code: row.code,
      name: row.name,
      description: row.description,
      parent_id: row.parent_id,
      position: row.position,

      answer_count: answerCount,
      total_weight: Number(row.total_weight || 0),
      correct_weight: Number(row.correct_weight || 0),

      mastery_percent: mastery,
      status,
      status_label: getStatusLabel(status)
    };
  });

  const started = skills.filter(
    (s) => s.status !== 'not_started'
  );

  const mastered = skills.filter(
    (s) => s.status === 'mastered'
  );

  const developing = skills.filter(
    (s) => s.status === 'developing'
  );

  const needsSupport = skills.filter(
    (s) => s.status === 'needs_support'
  );

  const totalAnswers = skills.reduce(
    (sum, skill) => sum + skill.answer_count,
    0
  );

  const overallMastery =
    started.length > 0
      ? Math.round(
          started.reduce(
            (sum, skill) => sum + skill.mastery_percent,
            0
          ) / started.length
        )
      : 0;

  return json({
    ok: true,

    student: {
      id: student.id,
      full_name: student.full_name,
      class_id: student.class_id,
      class_name: student.class_name,
      grade: student.grade
    },

    summary: {
      skill_count: skills.length,
      started_skill_count: started.length,
      not_started_skill_count:
        skills.length - started.length,

      mastered_skill_count: mastered.length,
      developing_skill_count: developing.length,
      needs_support_skill_count: needsSupport.length,

      answer_count: totalAnswers,
      mastery_percent: overallMastery
    },

    skills
  });
}
