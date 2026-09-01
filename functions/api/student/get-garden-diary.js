import { json, err } from '../_lib/http.js';
import { buildGardenDiary } from '../_lib/garden-diary.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const entries = await buildGardenDiary(env, student.id);
  return json({ entries });
}
