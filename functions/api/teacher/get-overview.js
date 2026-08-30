import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const pending = await env.DB.prepare(
    `SELECT COUNT(DISTINCT sub.id) AS n FROM submissions sub
     JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.teacher_id = ? AND a.school_id = ? AND sub.status = 'submitted'
       AND EXISTS (SELECT 1 FROM submission_answers sa WHERE sa.submission_id = sub.id AND sa.is_correct IS NULL)`
  ).bind(teacher.id, teacher.school_id).first();

  const weekSubmitted = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.teacher_id = ? AND a.school_id = ? AND sub.submitted_at >= datetime('now', '-7 days')`
  ).bind(teacher.id, teacher.school_id).first();

  const avgScoreRow = await env.DB.prepare(
    `SELECT AVG(sub.score) AS avg FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.teacher_id = ? AND a.school_id = ? AND sub.score IS NOT NULL`
  ).bind(teacher.id, teacher.school_id).first();

  const activeTasks = await env.DB.prepare('SELECT COUNT(*) AS n FROM assignments WHERE teacher_id = ? AND school_id = ?')
    .bind(teacher.id, teacher.school_id).first();

  const { results: chartRows } = await env.DB.prepare(
    `SELECT date(sub.submitted_at) AS d, COUNT(*) AS n FROM submissions sub
     JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.teacher_id = ? AND a.school_id = ? AND sub.submitted_at >= date('now', '-6 days')
     GROUP BY d`
  ).bind(teacher.id, teacher.school_id).all();
  const chartMap = new Map(chartRows.map((r) => [r.d, r.n]));

  const weeklyChart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    weeklyChart.push({ date: d, count: chartMap.get(d) || 0 });
  }

  return json({
    pendingReviewCount: pending.n,
    weekSubmittedCount: weekSubmitted.n,
    avgScore: avgScoreRow.avg !== null ? Math.round(avgScoreRow.avg) : null,
    activeTaskCount: activeTasks.n,
    weeklyChart,
  });
}
