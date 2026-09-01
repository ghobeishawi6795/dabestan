import { json, err } from '../_lib/http.js';
import { notify } from '../_lib/notify.js';
import { generateDuelQuestions } from '../_lib/duels.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  const duelId = body?.duelId;
  const accept = !!body?.accept;
  if (!duelId) return err('duelId is required');

  const duel = await env.DB.prepare('SELECT * FROM duels WHERE id = ? AND opponent_id = ?')
    .bind(duelId, student.id).first();
  if (!duel) return err('duel not found', 404);
  if (duel.status !== 'pending') return err('this duel is no longer pending', 400);

  if (!accept) {
    await env.DB.prepare(`UPDATE duels SET status = 'declined' WHERE id = ? AND status = 'pending'`).bind(duelId).run();
    await notify(env, duel.challenger_id, 'duel_declined', 'دعوت نبردت رد شد', student.full_name, duelId);
    return json({ ok: true, status: 'declined' });
  }

  const result = await env.DB.prepare(
    `UPDATE duels SET status = 'active', started_at = datetime('now') WHERE id = ? AND status = 'pending'`
  ).bind(duelId).run();
  if (!result.meta.changes) return err('this duel is no longer pending', 400);

  await generateDuelQuestions(env, duelId, duel.question_count);
  await notify(env, duel.challenger_id, 'duel_accepted', 'دعوت نبردت قبول شد ⚔️', `${student.full_name} آمادهٔ نبرده`, duelId);

  return json({ ok: true, status: 'active' });
}
