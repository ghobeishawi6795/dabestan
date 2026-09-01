import { json, err } from '../_lib/http.js';
import { getStreak } from '../_lib/badges.js';
import { getActiveFestival } from '../_lib/festival.js';

const XP_PER_LEVEL = 100;

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const user = await env.DB.prepare('SELECT growth_points, avatar, coins FROM users WHERE id = ?').bind(student.id).first();
  const points = user.growth_points;
  const level = Math.floor(points / XP_PER_LEVEL) + 1;
  const xpProgress = points % XP_PER_LEVEL;

  const streak = await getStreak(env, student.id);

  const { results: allBadges } = await env.DB.prepare('SELECT code, name, icon, description FROM badges').all();
  const { results: earned } = await env.DB.prepare('SELECT badge_code, earned_at FROM user_badges WHERE user_id = ?').bind(student.id).all();
  const earnedMap = new Map(earned.map((e) => [e.badge_code, e.earned_at]));
  const badges = allBadges.map((b) => ({ ...b, earned: earnedMap.has(b.code), earnedAt: earnedMap.get(b.code) || null }));

  const today = new Date().toISOString().slice(0, 10);
  const rewardToday = await env.DB.prepare('SELECT id FROM daily_rewards WHERE user_id = ? AND reward_date = ?')
    .bind(student.id, today).first();
  // جعبهٔ شانسی فقط وقتی باز می‌شه که امروز حداقل یک تکلیف ارسال کرده باشه و هنوز جعبهٔ امروز رو باز نکرده باشه
  const submittedToday = await env.DB.prepare(
    `SELECT id FROM submissions WHERE student_id = ? AND date(submitted_at) = ? LIMIT 1`
  ).bind(student.id, today).first();

  const doneCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM submissions WHERE student_id = ? AND status IN ('submitted','reviewed')`
  ).bind(student.id).first();

  // اعتبار کارت معافیت: تعداد ردیف‌های skip_card خریداری‌شده که هنوز مصرف نشدن.
  const skipCreditsRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM shop_purchases WHERE student_id = ? AND item_type = 'skip_card' AND used_at IS NULL`
  ).bind(student.id).first();

  const pet = await env.DB.prepare('SELECT species, accessories, last_fed_at FROM pets WHERE student_id = ?')
    .bind(student.id).first();

  const festival = getActiveFestival();

  return json({
    avatar: user.avatar,
    stars: points,
    level,
    xpProgress,
    xpPerLevel: XP_PER_LEVEL,
    streak,
    doneCount: doneCount.n,
    badges,
    luckyBoxAvailable: !!submittedToday && !rewardToday,
    coins: user.coins,
    skipCredits: skipCreditsRow.n,
    pet: pet ? { species: pet.species, accessories: JSON.parse(pet.accessories || '[]'), lastFedAt: pet.last_fed_at } : null,
    festival,
  });
}
