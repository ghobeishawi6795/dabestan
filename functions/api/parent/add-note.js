import { json, err } from '../_lib/http.js';

const MAX_CODE_LEN = 128;
const MAX_NOTE_LEN = 500;
const MAX_PARENT_NAME_LEN = 60;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);

    const code = String(body?.code || '').trim();
    const note = String(body?.note || '').trim().slice(0, MAX_NOTE_LEN);
    const parentName = String(
      body?.parentName || 'والدین'
    ).trim().slice(0, MAX_PARENT_NAME_LEN);

    if (!code) {
      return err('code is required', 400);
    }

    if (code.length > MAX_CODE_LEN) {
      return err('invalid code', 400);
    }

    if (!note) {
      return err('note is empty', 400);
    }

    const student = await env.DB.prepare(`
      SELECT id
      FROM users
      WHERE parent_code = ?
        AND role = 'student'
        AND is_active = 1
      LIMIT 1
    `).bind(code).first();

    if (!student) {
      return err('invalid code', 404);
    }

    await env.DB.prepare(`
      INSERT INTO parent_notes (
        student_id,
        parent_name,
        note,
        is_private
      )
      VALUES (?, ?, ?, ?)
    `).bind(
      student.id,
      parentName || 'والدین',
      note,
      body?.isPrivate ? 1 : 0
    ).run();

    return json({ ok: true });
  } catch (e) {
    console.error('parent add-note error:', e);
    return err('خطا در ثبت یادداشت والد', 500);
  }
}
