import { json, err } from '../_lib/http.js';

const MAX_CODE_LEN = 128;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const parentCode = String(body?.code || '').trim();

    if (!parentCode) return err('code is required', 400);
    if (parentCode.length > MAX_CODE_LEN) return err('invalid code', 400);

    const student = await env.DB.prepare(`
      SELECT
        u.id,
        c.teacher_id
      FROM users u
      LEFT JOIN classes c ON c.id = u.class_id
      WHERE u.parent_code = ?
        AND u.role = 'student'
        AND u.is_active = 1
      LIMIT 1
    `).bind(parentCode).first();

    if (!student) return err('invalid code', 404);

    if (!student.teacher_id) {
      return json({
        teacherName: null,
        messages: []
      });
    }

    const teacher = await env.DB.prepare(`
      SELECT full_name
      FROM users
      WHERE id = ?
        AND role = 'teacher'
        AND is_active = 1
      LIMIT 1
    `).bind(student.teacher_id).first();

    if (!teacher) {
      return json({
        teacherName: null,
        messages: []
      });
    }

    const { results } = await env.DB.prepare(`
      SELECT
        id,
        sender,
        body,
        created_at
      FROM parent_messages
      WHERE student_id = ?
        AND teacher_id = ?
      ORDER BY id ASC
      LIMIT 100
    `).bind(
      student.id,
      student.teacher_id
    ).all();

    await env.DB.prepare(`
      UPDATE parent_messages
      SET is_read = 1
      WHERE student_id = ?
        AND teacher_id = ?
        AND sender = 'teacher'
        AND is_read = 0
    `).bind(
      student.id,
      student.teacher_id
    ).run();

    return json({
      teacherName: teacher.full_name,
      messages: results
    });
  } catch (e) {
    console.error('parent list-messages error:', e);
    return err('خطا در دریافت پیام‌ها', 500);
  }
}
