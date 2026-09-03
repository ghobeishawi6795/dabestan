import { json, err } from '../_lib/http.js';
import { notify } from '../_lib/notify.js';

const MAX_LEN = 1000;

export async function onRequestPost({ request, env, data }) {
  try {
    const teacher = data.user;

    if (!teacher || teacher.role !== 'teacher') {
      return err('forbidden', 403);
    }

    const body = await request.json().catch(() => null);
    const studentId = Number(body?.studentId);
    const message = String(body?.body || '').trim();

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return err('studentId is required', 400);
    }

    if (!message) {
      return err('message body is required', 400);
    }

    if (message.length > MAX_LEN) {
      return err(`message exceeds ${MAX_LEN} characters`, 400);
    }

    const student = await env.DB.prepare(`
      SELECT
        s.id,
        s.full_name,
        c.teacher_id
      FROM users s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = ?
        AND c.teacher_id = ?
        AND s.role = 'student'
        AND s.is_active = 1
      LIMIT 1
    `).bind(
      studentId,
      teacher.id
    ).first();

    if (!student) {
      return err('student not found', 404);
    }

    const row = await env.DB.prepare(`
      INSERT INTO parent_messages (
        student_id,
        teacher_id,
        sender,
        body,
        is_read
      )
      VALUES (?, ?, 'teacher', ?, 0)
      RETURNING id, created_at
    `).bind(
      student.id,
      teacher.id,
      message
    ).first();

    return json({
      ok: true,
      id: row.id,
      createdAt: row.created_at
    });
  } catch (e) {
    console.error('teacher send-parent-message error:', e);
    return err('خطا در ارسال پیام به والد', 500);
  }
}
