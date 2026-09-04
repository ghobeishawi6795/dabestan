import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;

  if (!student || student.role !== 'student') {
    return err('forbidden', 403);
  }

  const [badgesResult, rewardsResult] = await Promise.all([
    env.DB.prepare(`
      SELECT
        b.code,
        b.name,
        b.icon,
        b.description,
        ub.earned_at
      FROM badges b
      LEFT JOIN user_badges ub
        ON ub.badge_code = b.code
       AND ub.user_id = ?
      ORDER BY
        CASE WHEN ub.earned_at IS NULL THEN 1 ELSE 0 END,
        ub.earned_at DESC,
        b.code ASC
    `).bind(student.id).all(),

    env.DB.prepare(`
      SELECT
        reward_date,
        reward_type,
        reward_value,
        created_at
      FROM daily_rewards
      WHERE user_id = ?
      ORDER BY reward_date DESC
      LIMIT 30
    `).bind(student.id).all()
  ]);

  const badges = (badgesResult.results || []).map((b) => ({
    code: b.code,
    name: b.name,
    icon: b.icon,
    description: b.description,
    earned: b.earned_at != null,
    earnedAt: b.earned_at || null
  }));

  const rewards = (rewardsResult.results || []).map((r) => ({
    date: r.reward_date,
    type: r.reward_type,
    value: Number(r.reward_value || 0),
    createdAt: r.created_at
  }));

  const earnedBadges = badges.filter((b) => b.earned);

  const rewardPoints = rewards.reduce(
    (sum, r) => sum + (r.type === 'points' ? r.value : 0),
    0
  );

  return json({
    ok: true,
    summary: {
      totalBadges: badges.length,
      earnedBadges: earnedBadges.length,
      remainingBadges: badges.length - earnedBadges.length,
      recentRewardPoints: rewardPoints
    },
    badges,
    rewards
  });
}
