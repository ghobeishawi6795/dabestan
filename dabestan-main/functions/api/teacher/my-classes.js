import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.grade,
            (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student') AS student_count
     FROM classes c WHERE c.teacher_id = ? AND c.school_id = ? ORDER BY c.id DESC`
  ).bind(teacher.id, teacher.school_id).all();

  for (const cls of results) {
    const agg = await env.DB.prepare(
      `SELECT AVG(sub.score) AS avg,
              COUNT(DISTINCT a.id) AS assignmentCount,
              COUNT(DISTINCT sub.id) AS submissionCount
       FROM assignments a
       LEFT JOIN submissions sub ON sub.assignment_id = a.id
       WHERE a.class_id = ? AND a.teacher_id = ?`
    ).bind(cls.id, teacher.id).first();
    const possibleSubmissions = agg.assignmentCount * cls.student_count;
    cls.avgScore = agg.avg !== null ? Math.round(agg.avg) : null;
    cls.progress = possibleSubmissions > 0 ? Math.round((agg.submissionCount / possibleSubmissions) * 100) : 0;
  }

  return json({ classes: results });
}
