import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const counts = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM classes WHERE school_id = ?').bind(admin.school_id),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE school_id = ? AND role = 'teacher'`).bind(admin.school_id),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE school_id = ? AND role = 'student'`).bind(admin.school_id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM assignments WHERE school_id = ?').bind(admin.school_id),
  ]);

  const school = await env.DB.prepare('SELECT name FROM schools WHERE id = ?').bind(admin.school_id).first();

  const avgScoreRow = await env.DB.prepare(
    `SELECT AVG(sub.score) AS avg FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.school_id = ? AND sub.score IS NOT NULL`
  ).bind(admin.school_id).first();

  const weekSubmitted = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.school_id = ? AND sub.submitted_at >= datetime('now', '-7 days')`
  ).bind(admin.school_id).first();

  const submissionRateRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT a.id) AS assignmentCount,
            (SELECT COUNT(*) FROM submissions sub2 JOIN assignments a2 ON a2.id = sub2.assignment_id WHERE a2.school_id = ?) AS submissionCount
     FROM assignments a WHERE a.school_id = ?`
  ).bind(admin.school_id, admin.school_id).first();
  const studentCount = counts[2].results[0].n;
  const possible = submissionRateRow.assignmentCount * studentCount;
  const submissionRate = possible > 0 ? Math.round((submissionRateRow.submissionCount / possible) * 100) : 0;

  const satisfactionRow = await env.DB.prepare(
    `SELECT AVG(pf.rating) AS avg FROM parent_feedback pf
     JOIN users t ON t.id = pf.teacher_id WHERE t.school_id = ?`
  ).bind(admin.school_id).first();
  const satisfactionPct = satisfactionRow.avg !== null ? Math.round((satisfactionRow.avg / 5) * 100) : null;

  const { results: chartRows } = await env.DB.prepare(
    `SELECT date(sub.submitted_at) AS d, COUNT(*) AS n FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE a.school_id = ? AND sub.submitted_at >= date('now', '-6 days') GROUP BY d`
  ).bind(admin.school_id).all();
  const chartMap = new Map(chartRows.map((r) => [r.d, r.n]));
  const weeklyChart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    weeklyChart.push({ date: d, count: chartMap.get(d) || 0 });
  }

  const healthComponents = [avgScoreRow.avg, submissionRate, satisfactionPct].filter((v) => v !== null && v !== undefined);
  const healthScore = healthComponents.length ? Math.round(healthComponents.reduce((s, v) => s + v, 0) / healthComponents.length) : 0;

  return json({
    schoolName: school?.name ?? '',
    classCount: counts[0].results[0].n,
    teacherCount: counts[1].results[0].n,
    studentCount,
    activeTaskCount: counts[3].results[0].n,
    avgScore: avgScoreRow.avg !== null ? Math.round(avgScoreRow.avg) : null,
    weekSubmittedCount: weekSubmitted.n,
    submissionRate,
    satisfactionPct,
    healthScore,
    weeklyChart,
  });
}
