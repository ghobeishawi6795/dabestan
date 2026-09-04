import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('teacher access required', 403);
  }

  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('class_id'));

  if (!Number.isInteger(classId) || classId <= 0) {
    return err('invalid class_id', 400);
  }

  const classRow = await env.DB.prepare(`
    SELECT id, name, grade
    FROM classes
    WHERE id = ?
      AND teacher_id = ?
      AND school_id = ?
    LIMIT 1
  `).bind(
    classId,
    teacher.id,
    teacher.school_id
  ).first();

  if (!classRow) {
    return err('class not found', 404);
  }

  const { results } = await env.DB.prepare(`
    SELECT
      date(
        sub.submitted_at,
        'weekday 1',
        '-7 days'
      ) AS week_start,
      ROUND(AVG(sub.score), 1) AS average_score,
      COUNT(*) AS submission_count
    FROM submissions sub
    INNER JOIN assignments a
      ON a.id = sub.assignment_id
    WHERE a.teacher_id = ?
      AND a.school_id = ?
      AND a.class_id = ?
      AND sub.status = 'reviewed'
      AND sub.score IS NOT NULL
      AND sub.submitted_at IS NOT NULL
      AND sub.submitted_at >= date('now', '-55 days')
    GROUP BY week_start
    ORDER BY week_start ASC
  `).bind(
    teacher.id,
    teacher.school_id,
    classId
  ).all();

  const trend = results.map((row) => ({
    week: row.week_start,
    average: Math.round(Number(row.average_score || 0)),
    submissions: Number(row.submission_count || 0)
  }));

  const currentAverage =
    trend.length > 0
      ? trend[trend.length - 1].average
      : null;

  const firstAverage =
    trend.length > 0
      ? trend[0].average
      : null;

  const change =
    currentAverage != null && firstAverage != null
      ? currentAverage - firstAverage
      : null;

  return json({
    ok: true,

    class: {
      id: Number(classRow.id),
      name: classRow.name,
      grade: classRow.grade
    },

    summary: {
      current_average: currentAverage,
      change
    },

    trend
  });
}
