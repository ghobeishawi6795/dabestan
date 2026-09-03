import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.challengeDate) return err('title and challengeDate required');

  try {
    await env.DB.prepare(
      `INSERT INTO daily_challenges (school_id, title, description, challenge_date, reward_coins, reward_xp)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (school_id, challenge_date) DO UPDATE SET title = excluded.title, description = excluded.description, reward_coins = excluded.reward_coins, reward_xp = excluded.reward_xp`
    ).bind(
      teacher.school_id, body.title, body.description || null, body.challengeDate,
      body.rewardCoins || 10, body.rewardXp || 20
    ).run();

    return json({ ok: true });
  } catch (e) {
    return err('failed to create challenge', 500);
  }
}
