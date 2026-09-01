import { json, err } from '../_lib/http.js';
import { notify } from '../_lib/notify.js';

const QUESTION_COUNT = 5;

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);
  if (!student.class_id) return err('you are not assigned to a class', 400);

  const body = await request.json().catch(() => null);
  const opponentId = body?.opponentId;
  if (!opponentId) return err('opponentId is required');
  if (Number(opponentId) === student.id) return err('cannot challenge yourself', 400);

  const opponent = await env.DB.prepare(
    `SELECT id FROM users WHERE id = ? AND class_id = ? AND role = 'student' AND is_active = 1`
  ).bind(opponentId, student.class_id).first();
  if (!opponent) return err('opponent not found in your class', 404);

  const existing = await env.DB.prepare(
    `SELECT id FROM duels
     WHERE status IN ('pending', 'active')
       AND ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?))`
  ).bind(student.id, opponentId, opponentId, student.id).first();
  if (existing) return err('there is already a pending or active duel between you two', 400);

  const duel = await env.DB.prepare(
    `INSERT INTO duels (school_id, class_id, challenger_id, opponent_id, question_count)
     VALUES (?, ?, ?, ?, ?) RETURNING id`
  ).bind(student.school_id, student.class_id, student.id, opponentId, QUESTION_COUNT).first();

  await notify(env, opponentId, 'duel_challenge', 'یه نفر به نبرد دعوتت کرد ⚔️', `${student.full_name} می‌خواد باهات نبرد ریاضی کنه`, duel.id);

  return json({ ok: true, duelId: duel.id });
}
