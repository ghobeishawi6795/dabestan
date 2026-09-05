import { json, err } from '../_lib/http.js';
import { getStreak } from '../_lib/badges.js';
import { getActiveFestival } from '../_lib/festival.js';
import { getGardenWeather } from '../_lib/garden-weather.js';

const XP_PER_LEVEL = 100;

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const user = await env.DB.prepare('SELECT growth_points, avatar FROM users WHERE id = ?').bind(student.id).first();
  const points = user.growth_points;
  const level = Math.floor(points / XP_PER_LEVEL) + 1;
  const xpProgress = points % XP_PER_LEVEL;

  const streak = await getStreak(env, student.id);

  const { results: allBadges } = await env.DB.prepare('SELECT code, name, icon, description FROM badges').all();
  const { results: earned } = await env.DB.prepare('SELECT badge_code, earned_at FROM user_badges WHERE user_id = ?').bind(student.id).all();
  const earnedMap = new Map(earned.map((e) => [e.badge_code, e.earned_at]));
  const badges = allBadges.map((b) => ({ ...b, earned: earnedMap.has(b.code), earnedAt: earnedMap.get(b.code) || null }));

  const doneCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM submissions WHERE student_id = ? AND status IN ('submitted','reviewed')`
  ).bind(student.id).first();

  const festival = getActiveFestival();
  const gardenWeather = await getGardenWeather(env, student.id);

  return json({
    avatar: user.avatar,
    stars: points,
    level,
    xpProgress,
    xpPerLevel: XP_PER_LEVEL,
    streak,
    doneCount: doneCount.n,
    badges,
    festival,
    gardenWeather,
  });
}
