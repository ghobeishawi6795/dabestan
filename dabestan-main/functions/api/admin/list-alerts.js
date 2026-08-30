import { json, err } from '../_lib/http.js';

const INCOMPLETE_THRESHOLD = 3;
const SCORE_DROP_THRESHOLD = 15;

export async function onRequestGet({ env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const alerts = [];

  // هشدار ۱: افت نمره — آخرین نمره نسبت به میانگین نمرات قبلی همون دانش‌آموز
  const { results: scoreRows } = await env.DB.prepare(
    `SELECT sub.student_id, u.full_name, c.name AS class_name, sub.score, sub.id,
            (SELECT AVG(s2.score) FROM submissions s2 WHERE s2.student_id = sub.student_id AND s2.score IS NOT NULL AND s2.id != sub.id) AS priorAvg
     FROM submissions sub
     JOIN users u ON u.id = sub.student_id
     LEFT JOIN classes c ON c.id = u.class_id
     WHERE u.school_id = ? AND sub.score IS NOT NULL
     ORDER BY sub.id DESC`
  ).bind(admin.school_id).all();

  const seenStudents = new Set();
  for (const row of scoreRows) {
    if (seenStudents.has(row.student_id)) continue; // فقط آخرین ارسالی هر دانش‌آموز رو چک کن
    seenStudents.add(row.student_id);
    if (row.priorAvg !== null && row.score < row.priorAvg - SCORE_DROP_THRESHOLD) {
      alerts.push({
        studentName: row.full_name, className: row.class_name,
        message: `افت نمره (${Math.round(row.priorAvg)} ← ${row.score})`, level: 'danger',
      });
    }
  }

  // هشدار ۲: تعداد زیاد تکلیف انجام‌نشده
  const { results: incompleteRows } = await env.DB.prepare(
    `SELECT u.id AS student_id, u.full_name, c.name AS class_name,
            COUNT(a.id) AS incompleteCount
     FROM users u
     JOIN classes c ON c.id = u.class_id
     JOIN assignments a ON a.class_id = u.class_id
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = u.id
     WHERE u.school_id = ? AND u.role = 'student' AND sub.id IS NULL
     GROUP BY u.id HAVING incompleteCount >= ?`
  ).bind(admin.school_id, INCOMPLETE_THRESHOLD).all();

  for (const row of incompleteRows) {
    alerts.push({
      studentName: row.full_name, className: row.class_name,
      message: `${row.incompleteCount} تکلیف انجام نشده`, level: 'warn',
    });
  }

  return json({ alerts: alerts.slice(0, 12) });
}
