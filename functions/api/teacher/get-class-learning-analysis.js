import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('forbidden', 403);
  }

  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('class_id'));

  if (!Number.isInteger(classId) || classId <= 0) {
    return err('class_id is required', 400);
  }

  const classRow = await env.DB.prepare(
    `SELECT id, name
     FROM classes
     WHERE id = ?
       AND school_id = ?`
  ).bind(classId, teacher.school_id).first();

  if (!classRow) {
    return err('class not found', 404);
  }

  const { results: students } = await env.DB.prepare(
    `SELECT
       u.id,
       u.name,
       u.username
     FROM users u
     WHERE u.school_id = ?
       AND u.class_id = ?
       AND u.role = 'student'
     ORDER BY u.name ASC, u.id ASC`
  ).bind(teacher.school_id, classId).all();

  if (!students.length) {
    return json({
      ok: true,
      class: classRow,
      summary: {
        studentCount: 0,
        studentsWithActivity: 0,
        averageScore: null,
        averageMastery: null,
        needsSupport: 0,
        developing: 0,
        mastered: 0,
      },
      students: [],
    });
  }

  const studentIds = students.map(s => Number(s.id));
  const placeholders = studentIds.map(() => '?').join(',');

  const { results: stats } = await env.DB.prepare(
    `SELECT
       u.id AS student_id,
       u.name,
       u.username,
       COUNT(DISTINCT s.id) AS submission_count,
       AVG(s.score) AS average_score,
       MAX(s.score) AS best_score,
       COALESCE(SUM(ssr.correct_count), 0) AS correct_count,
       COALESCE(SUM(ssr.answer_count), 0) AS answer_count
     FROM users u
     LEFT JOIN submissions s
       ON s.student_id = u.id
     LEFT JOIN student_skill_results ssr
       ON ssr.student_id = u.id
     WHERE u.id IN (${placeholders})
     GROUP BY u.id, u.name, u.username
     ORDER BY u.name ASC, u.id ASC`
  ).bind(...studentIds).all();

  const normalized = stats.map(row => {
    const answerCount = Number(row.answer_count || 0);
    const correctCount = Number(row.correct_count || 0);

    const mastery = answerCount
      ? Math.round(correctCount * 100 / answerCount)
      : 0;

    const averageScore = row.average_score == null
      ? null
      : Math.round(Number(row.average_score));

    let status = 'not_started';

    if (answerCount > 0) {
      if (mastery < 60) status = 'needs_support';
      else if (mastery < 80) status = 'developing';
      else status = 'mastered';
    }

    return {
      id: Number(row.student_id),
      name: row.name,
      username: row.username,
      submissionCount: Number(row.submission_count || 0),
      averageScore,
      bestScore:
        row.best_score == null
          ? null
          : Number(row.best_score),
      correctCount,
      answerCount,
      mastery,
      status,
    };
  });

  const active = normalized.filter(s => s.answerCount > 0);

  const averageScore = active.filter(
    s => s.averageScore != null
  );

  const classAverageScore = averageScore.length
    ? Math.round(
        averageScore.reduce((sum, s) => sum + s.averageScore, 0) /
        averageScore.length
      )
    : null;

  const classAverageMastery = active.length
    ? Math.round(
        active.reduce((sum, s) => sum + s.mastery, 0) /
        active.length
      )
    : null;

  const needsSupport = normalized.filter(
    s => s.status === 'needs_support'
  ).length;

  const developing = normalized.filter(
    s => s.status === 'developing'
  ).length;

  const mastered = normalized.filter(
    s => s.status === 'mastered'
  ).length;

  return json({
    ok: true,

    class: {
      id: Number(classRow.id),
      name: classRow.name,
    },

    summary: {
      studentCount: normalized.length,
      studentsWithActivity: active.length,
      averageScore: classAverageScore,
      averageMastery: classAverageMastery,
      needsSupport,
      developing,
      mastered,
    },

    students: normalized,
  });
}
