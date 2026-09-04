import { json, err } from '../_lib/http.js';
import { buildGardenDiary } from '../_lib/garden-diary.js';

const MAX_CODE_LEN = 128;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const parentCode = String(body?.code || '').trim();

    if (!parentCode) {
      return err('code is required', 400);
    }

    if (parentCode.length > MAX_CODE_LEN) {
      return err('invalid code', 400);
    }

    const student = await env.DB.prepare(`
      SELECT id
      FROM users
      WHERE parent_code = ?
        AND role = 'student'
        AND is_active = 1
      LIMIT 1
    `).bind(parentCode).first();

    if (!student) {
      return err('invalid code', 404);
    }

    const entries = await buildGardenDiary(env, student.id);

    return json({ entries });
  } catch (e) {
    console.error('parent get-garden-diary error:', e);
    return err('خطا در دریافت دفتر باغچه', 500);
  }
}
