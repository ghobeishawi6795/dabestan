import { json, err } from '../_lib/http.js';
import { buildGardenDiary } from '../_lib/garden-diary.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const parentCode = url.searchParams.get('code');
  if (!parentCode) return err('code query param is required');

  const student = await env.DB.prepare(`SELECT id FROM users WHERE parent_code = ? AND role = 'student'`)
    .bind(parentCode).first();
  if (!student) return err('invalid code', 404);

  const entries = await buildGardenDiary(env, student.id);
  return json({ entries });
}
