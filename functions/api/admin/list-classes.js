import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.grade, t.full_name AS teacher_name,
            (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student') AS student_count
     FROM classes c
     LEFT JOIN users t ON t.id = c.teacher_id
     WHERE c.school_id = ?
     ORDER BY c.id DESC`
  ).bind(admin.school_id).all();

  for (const cls of results) {
    const agg = await env.DB.prepare(
      `SELECT AVG(sub.score) AS avg, COUNT(DISTINCT a.id) AS assignmentCount, COUNT(DISTINCT sub.id) AS submissionCount
       FROM assignments a LEFT JOIN submissions sub ON sub.assignment_id = a.id
       WHERE a.class_id = ?`
    ).bind(cls.id).first();
    const possible = agg.assignmentCount * cls.student_count;
    cls.avgScore = agg.avg !== null ? Math.round(agg.avg) : null;
    cls.progress = possible > 0 ? Math.round((agg.submissionCount / possible) * 100) : 0;
  }

  results.sort((a, b) => b.progress - a.progress);
  return json({ classes: results });
}
