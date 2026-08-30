import { json, err } from '../_lib/http.js';

export async function onRequestPost({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const today = new Date().toISOString().slice(0, 10);

  const submittedToday = await env.DB.prepare(
    `SELECT id FROM submissions WHERE student_id = ? AND date(submitted_at) = ? LIMIT 1`
  ).bind(student.id, today).first();
  if (!submittedToday) return err('یک تکلیف امروز ارسال کن تا جعبهٔ شانسی باز بشه', 400);

  const existing = await env.DB.prepare('SELECT id FROM daily_rewards WHERE user_id = ? AND reward_date = ?')
    .bind(student.id, today).first();
  if (existing) return err('جعبهٔ شانسی امروز رو قبلاً باز کردی', 409);

  const rewardValue = 10 + Math.floor(Math.random() * 21); // 10..30

  await env.DB.prepare('INSERT INTO daily_rewards (user_id, reward_date, reward_type, reward_value) VALUES (?, ?, ?, ?)')
    .bind(student.id, today, 'points', rewardValue).run();
  await env.DB.prepare('UPDATE users SET growth_points = growth_points + ? WHERE id = ?')
    .bind(rewardValue, student.id).run();

  const updated = await env.DB.prepare('SELECT growth_points FROM users WHERE id = ?').bind(student.id).first();
  return json({ ok: true, rewardValue, growthPoints: updated.growth_points });
}
