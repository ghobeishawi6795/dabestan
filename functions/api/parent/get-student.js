import { json, err } from '../_lib/http.js';

const MAX_CODE_LEN = 128;

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const parentCode = String(url.searchParams.get('code') || '').trim();

    if (!parentCode) {
      return err('code query param is required', 400);
    }

    if (parentCode.length > MAX_CODE_LEN) {
      return err('invalid code', 400);
    }

    const student = await env.DB.prepare(`
      SELECT
        u.id,
        u.full_name,
        u.growth_points,
        u.class_id,
        c.name AS class_name,
        s.name AS school_name,
        s.theme_color AS school_theme_color
      FROM users u
      LEFT JOIN classes c ON c.id = u.class_id
      LEFT JOIN schools s ON s.id = u.school_id
      WHERE u.parent_code = ?
        AND u.role = 'student'
        AND u.is_active = 1
      LIMIT 1
    `).bind(parentCode).first();

    if (!student) {
      return err('invalid code', 404);
    }

    const { results: recent } = await env.DB.prepare(`
      SELECT
        sub.id AS submissionId,
        a.title,
        sub.status,
        sub.score,
        sub.submitted_at,
        t.full_name AS teacherName,
        (
          SELECT pf.rating
          FROM parent_feedback pf
          WHERE pf.submission_id = sub.id
          LIMIT 1
        ) AS myRating
      FROM submissions sub
      JOIN assignments a ON a.id = sub.assignment_id
      JOIN users t ON t.id = a.teacher_id
      WHERE sub.student_id = ?
        AND a.class_id = ?
      ORDER BY sub.id DESC
      LIMIT 10
    `).bind(student.id, student.class_id).all();

    const pending = await env.DB.prepare(`
      SELECT COUNT(*) AS n
      FROM assignments a
      WHERE a.class_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM submissions sub
          WHERE sub.assignment_id = a.id
            AND sub.student_id = ?
        )
    `).bind(student.class_id, student.id).first();

    return json({
      student: {
        id: student.id,
        fullName: student.full_name,
        className: student.class_name,
        schoolName: student.school_name,
        growthPoints: Number(student.growth_points || 0),
        schoolThemeColor: student.school_theme_color
      },
      recentSubmissions: recent,
      pendingCount: Number(pending?.n || 0)
    });
  } catch (e) {
    console.error('parent get-student error:', e);
    return err('خطا در دریافت اطلاعات دانش‌آموز', 500);
  }
}
