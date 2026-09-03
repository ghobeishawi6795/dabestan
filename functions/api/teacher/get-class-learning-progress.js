import { json, err } from '../_lib/http.js';

function getMasteryStatus(percent, answerCount) {
  if (!answerCount || answerCount <= 0) return 'not_started';
  if (percent < 60) return 'needs_support';
  if (percent < 80) return 'developing';
  return 'mastered';
}

export async function onRequestGet({ request, env }) {
  const teacher = request.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('teacher access required', 403);
  }

  const url = new URL(request.url);
  const classIdParam = url.searchParams.get('class_id');

  let classId = classIdParam
    ? Number(classIdParam)
    : null;

  if (classIdParam && (!Number.isInteger(classId) || classId <= 0)) {
    return err('invalid class_id');
  }

  let classQuery = `
    SELECT id, name, grade
    FROM classes
    WHERE teacher_id = ?
      AND school_id = ?
  `;

  const classParams = [
    teacher.id,
    teacher.school_id
  ];

  if (classId) {
    classQuery += ` AND id = ?`;
    classParams.push(classId);
  }

  classQuery += ` ORDER BY id ASC`;

  const { results: classes } = await env.DB.prepare(
    classQuery
  ).bind(...classParams).all();

  if (!classes.length) {
    return err('class not found', 404);
  }

  const output = [];

  for (const cls of classes) {
    const { results: students } = await env.DB.prepare(`
      SELECT
        id,
        full_name,
        avatar
      FROM users
      WHERE
        school_id = ?
        AND role = 'student'
        AND class_id = ?
        AND is_active = 1
      ORDER BY full_name COLLATE NOCASE ASC
    `).bind(
      teacher.school_id,
      cls.id
    ).all();

    const studentRows = [];

    for (const student of students) {
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
          WHERE
            la.rn = 1
            AND s.student_id = ?
            AND s.status = 'reviewed'
            AND s.excused = 0
            AND a.teacher_id = ?
            AND a.school_id = ?
            AND qs.skill_id IN (
              SELECT id
              FROM learning_skills
              WHERE school_id = ?
                AND is_active = 1
            )
            AND la.is_correct IS NOT NULL
        )

        SELECT
          COUNT(*) AS answer_count,
          COALESCE(SUM(weight), 0) AS total_weight,
          COALESCE(
            SUM(
              CASE
                WHEN is_correct = 1 THEN weight
                ELSE 0
              END
            ),
            0
          ) AS correct_weight
        FROM skill_answers
      `).bind(
        student.id,
        teacher.id,
        teacher.school_id,
        teacher.school_id
      ).all();

      const row = results[0] || {};

      const answerCount = Number(row.answer_count || 0);
      const totalWeight = Number(row.total_weight || 0);
      const correctWeight = Number(row.correct_weight || 0);

      const mastery =
        totalWeight > 0
          ? Math.round(
              (correctWeight * 100) / totalWeight
            )
          : 0;

      studentRows.push({
        id: student.id,
        full_name: student.full_name,
        avatar: student.avatar,

        answer_count: answerCount,
        mastery_percent: mastery,
        status: getMasteryStatus(
          mastery,
          answerCount
        )
      });
    }

    const activeStudents = studentRows.filter(
      (student) => student.answer_count > 0
    );

    const classMastery =
      activeStudents.length > 0
        ? Math.round(
            activeStudents.reduce(
              (sum, student) =>
                sum + student.mastery_percent,
              0
            ) / activeStudents.length
          )
        : 0;

    output.push({
      id: cls.id,
      name: cls.name,
      grade: cls.grade,

      summary: {
        student_count: studentRows.length,
        active_learning_students:
          activeStudents.length,
        mastery_percent: classMastery,

        mastered_count: studentRows.filter(
          (s) => s.status === 'mastered'
        ).length,

        developing_count: studentRows.filter(
          (s) => s.status === 'developing'
        ).length,

        needs_support_count: studentRows.filter(
          (s) => s.status === 'needs_support'
        ).length,

        not_started_count: studentRows.filter(
          (s) => s.status === 'not_started'
        ).length
      },

      students: studentRows
    });
  }

  return json({
    ok: true,
    classes: output
  });
}
