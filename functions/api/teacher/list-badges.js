import { json, err } from '../_lib/http.js';
import { TEACHER_BADGE_CODES } from '../_lib/teacher-badges.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const placeholders = TEACHER_BADGE_CODES.map(() => '?').join(',');
  const { results: defs } = await env.DB.prepare(
    `SELECT code, name, icon, description FROM badges WHERE code IN (${placeholders})`
  ).bind(...TEACHER_BADGE_CODES).all();

  const { results: earned } = await env.DB.prepare(
    `SELECT badge_code, earned_at FROM user_badges WHERE user_id = ? AND badge_code IN (${placeholders})`
  ).bind(teacher.id, ...TEACHER_BADGE_CODES).all();
  const earnedMap = new Map(earned.map((e) => [e.badge_code, e.earned_at]));

  const badges = defs.map((b) => ({ ...b, earned: earnedMap.has(b.code), earnedAt: earnedMap.get(b.code) || null }));
  return json({ badges });
}
