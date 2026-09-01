import { json, err } from '../_lib/http.js';
import { tryFinalizeDuel } from '../_lib/duels.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  const { duelId, position, answer } = body || {};
  if (!duelId || position === undefined || answer === undefined) {
    return err('duelId, position, answer are required');
  }

  const duel = await env.DB.prepare('SELECT * FROM duels WHERE id = ?').bind(duelId).first();
  if (!duel || (duel.challenger_id !== student.id && duel.opponent_id !== student.id)) return err('duel not found', 404);
  if (duel.status !== 'active') return err('this duel is not active', 400);

  const myCountRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM duel_answers WHERE duel_id = ? AND student_id = ?')
    .bind(duelId, student.id).first();
  if (Number(position) !== myCountRow.n) return err('out of order — refresh the duel', 400);

  const q = await env.DB.prepare('SELECT answer FROM duel_questions WHERE duel_id = ? AND position = ?')
    .bind(duelId, position).first();
  if (!q) return err('question not found', 404);

  const isCorrect = Number(answer) === q.answer ? 1 : 0;
  try {
    await env.DB.prepare(
      'INSERT INTO duel_answers (duel_id, student_id, position, submitted_answer, is_correct) VALUES (?, ?, ?, ?, ?)'
    ).bind(duelId, student.id, position, Number(answer), isCorrect).run();
  } catch {
    return err('this question was already answered', 400); // race: two submits for the same position
  }

  const finalized = await tryFinalizeDuel(env, duel);

  return json({
    ok: true,
    isCorrect: !!isCorrect,
    correctAnswer: q.answer,
    finished: !!finalized,
    result: finalized ? {
      outcome: finalized.winnerId === null ? 'draw' : (finalized.winnerId === student.id ? 'win' : 'lose'),
      myScore: duel.challenger_id === student.id ? finalized.challengerScore.correct : finalized.opponentScore.correct,
      opponentScore: duel.challenger_id === student.id ? finalized.opponentScore.correct : finalized.challengerScore.correct,
    } : null,
    newlyEarnedBadges: finalized ? (finalized.newlyEarnedBadges[student.id] || []) : [],
  });
}
