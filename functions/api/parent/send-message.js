import { json, err } from '../_lib/http.js';
import { notify } from '../_lib/notify.js';

const MAX_CODE_LEN = 128;
const MAX_LEN = 1000;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);

    const code = String(body?.code || '').trim();
    const message = String(body?.body || '').trim();

    if (!code) {
      return err('code is required', 400);
    }

    if (code.length > MAX_CODE_LEN) {
      return err('invalid code', 400);
    }

    if (!message) {
      return err('message body is required', 400);
    }

    if (message.length > MAX_LEN) {
      return err(`message exceeds ${MAX_LEN} characters`, 400);
    }

    const student = await env.DB.prepare(`
      SELECT
        u.id,
        u.full_name,
        c.teacher_id
      FROM users u
      LEFT JOIN classes c ON c.id = u.class_id
      WHERE u.parent_code = ?
        AND u.role = 'student'
        AND u.is_active = 1
      LIMIT 1
    `).bind(code).first();

    if (!student) {
      return err('invalid code', 404);
    }

    if (!student.teacher_id) {
      return err('this student has no assigned teacher yet', 400);
    }

    const teacher = await env.DB.prepare(`
      SELECT id
      FROM users
      WHERE id = ?
        AND role = 'teacher'
        AND is_active = 1
      LIMIT 1
    `).bind(student.teacher_id).first();

    if (!teacher) {
      return err('assigned teacher not found', 404);
    }

    const row = await env.DB.prepare(`
      INSERT INTO parent_messages (
        student_id,
        teacher_id,
        sender,
        body,
        is_read
      )
      VALUES (?, ?, 'parent', ?, 0)
      RETURNING id, created_at
    `).bind(
      student.id,
      teacher.id,
      message
    ).first();

    await notify(
      env,
      teacher.id,
      'parent_message',
      `پیام از والدین ${student.full_name}`,
      message,
      row.id
    );

    return json({
      ok: true,
      id: row.id,
      createdAt: row.created_at
    });
  } catch (e) {
    console.error('parent send-message error:', e);
    return err('خطا در ارسال پیام به معلم', 500);
  }
}
