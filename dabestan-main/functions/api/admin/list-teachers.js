import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT id, username, full_name, is_active,
            (SELECT COUNT(*) FROM classes c WHERE c.teacher_id = users.id) AS class_count
     FROM users WHERE school_id = ? AND role = 'teacher' ORDER BY id DESC`
  ).bind(admin.school_id).all();

  for (const t of results) {
    const perf = await env.DB.prepare(
      `SELECT AVG(sub.score) AS avgScore, COUNT(DISTINCT a.id) AS taskCount
       FROM assignments a LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.score IS NOT NULL
       WHERE a.teacher_id = ?`
    ).bind(t.id).first();
    const satisfaction = await env.DB.prepare(
      'SELECT AVG(rating) AS avg, COUNT(*) AS n FROM parent_feedback WHERE teacher_id = ?'
    ).bind(t.id).first();

    t.avgScore = perf.avgScore !== null ? Math.round(perf.avgScore) : null;
    t.taskCount = perf.taskCount;
    t.satisfactionPct = satisfaction.avg !== null ? Math.round((satisfaction.avg / 5) * 100) : null;
    t.satisfactionCount = satisfaction.n;
    // امتیاز عملکرد: ترکیب میانگین نمرهٔ دانش‌آموزان و رضایت والدین (هرکدوم موجود بود)
    const parts = [t.avgScore, t.satisfactionPct].filter((v) => v !== null);
    t.performance = parts.length ? Math.round(parts.reduce((s, v) => s + v, 0) / parts.length) : null;
  }

  results.sort((a, b) => (b.performance ?? -1) - (a.performance ?? -1));
  return json({ teachers: results });
}
