import { json, err } from '../_lib/http.js';

// Intentionally passwordless — parent_code is a long random per-student code (see admin/add-student.js),
// not guessable, and this endpoint only ever returns read-only summary data for that one student.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const parentCode = url.searchParams.get('code');
  if (!parentCode) return err('code query param is required');

  const student = await env.DB.prepare(
    `SELECT u.id, u.full_name, u.growth_points, c.name AS class_name, s.name AS school_name, s.theme_color AS school_theme_color
     FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN schools s ON s.id = u.school_id
     WHERE u.parent_code = ? AND u.role = 'student'`
  ).bind(parentCode).first();
  if (!student) return err('invalid code', 404);

  const { results: recent } = await env.DB.prepare(
    `SELECT sub.id AS submissionId, a.title, sub.status, sub.score, sub.submitted_at,
            t.full_name AS teacherName,
            (SELECT rating FROM parent_feedback pf WHERE pf.submission_id = sub.id) AS myRating
     FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     JOIN users t ON t.id = a.teacher_id
     WHERE sub.student_id = ? ORDER BY sub.id DESC LIMIT 10`
  ).bind(student.id).all();

  const pending = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM assignments a
     WHERE a.class_id = (SELECT class_id FROM users WHERE id = ?)
       AND NOT EXISTS (SELECT 1 FROM submissions sub WHERE sub.assignment_id = a.id AND sub.student_id = ?)`
  ).bind(student.id, student.id).first();

  return json({
    student: { fullName: student.full_name, className: student.class_name, schoolName: student.school_name, growthPoints: student.growth_points, schoolThemeColor: student.school_theme_color },
    recentSubmissions: recent,
    pendingCount: pending.n,
  });
}
