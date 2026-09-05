import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;

  if (!student || student.role !== 'student') {
    return err('forbidden', 403);
  }

  const badgesResult = await env.DB.prepare(`
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
  `).bind(student.id).all();

  const badges = (badgesResult.results || []).map((b) => ({
    code: b.code,
    name: b.name,
    icon: b.icon,
    description: b.description,
    earned: b.earned_at != null,
    earnedAt: b.earned_at || null
  }));

  const earnedBadges = badges.filter((b) => b.earned);

  return json({
    ok: true,
    summary: {
      totalBadges: badges.length,
      earnedBadges: earnedBadges.length,
      remainingBadges: badges.length - earnedBadges.length
    },
    badges
  });
}
