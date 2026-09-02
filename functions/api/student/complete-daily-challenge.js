import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.challengeId) return err('challengeId required');

  const challenge = await env.DB.prepare(
    'SELECT * FROM daily_challenges WHERE id = ? AND school_id = ?'
  ).bind(body.challengeId, student.school_id).first();
  if (!challenge) return err('challenge not found', 404);

  const today = new Date().toISOString().slice(0, 10);
  if (challenge.challenge_date !== today) return err('این چالش مربوط به امروز نیست', 400);

  // چک کن قبلاً تکمیل شده یا نه
  const existing = await env.DB.prepare(
    'SELECT completed FROM challenge_participants WHERE challenge_id = ? AND student_id = ?'
  ).bind(challenge.id, student.id).first();

  if (existing && existing.completed === 1) {
    return err('این چالش قبلاً تکمیل شده', 400);
  }

  // ثبت تکمیل + پاداش (فقط یکبار)
  await env.DB.prepare(
    `INSERT INTO challenge_participants (challenge_id, student_id, completed, completed_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT (challenge_id, student_id) DO UPDATE SET completed = 1, completed_at = datetime('now')`
  ).bind(challenge.id, student.id).run();

  await env.DB.prepare(
    'UPDATE users SET coins = coins + ?, growth_points = growth_points + ? WHERE id = ?'
  ).bind(challenge.reward_coins, challenge.reward_xp, student.id).run();

  return json({ ok: true, coins: challenge.reward_coins, xp: challenge.reward_xp });
}
