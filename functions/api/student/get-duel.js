import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const url = new URL(request.url);
  const duelId = url.searchParams.get('id');
  if (!duelId) return err('id is required');

  const duel = await env.DB.prepare(
    `SELECT d.*, c.full_name AS challenger_name, o.full_name AS opponent_name
     FROM duels d JOIN users c ON c.id = d.challenger_id JOIN users o ON o.id = d.opponent_id
     WHERE d.id = ?`
  ).bind(duelId).first();
  if (!duel || (duel.challenger_id !== student.id && duel.opponent_id !== student.id)) return err('duel not found', 404);

  const opponentId = duel.challenger_id === student.id ? duel.opponent_id : duel.challenger_id;
  const opponentName = duel.challenger_id === student.id ? duel.opponent_name : duel.challenger_name;

  const myCountRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM duel_answers WHERE duel_id = ? AND student_id = ?')
    .bind(duelId, student.id).first();
  const oppCountRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM duel_answers WHERE duel_id = ? AND student_id = ?')
    .bind(duelId, opponentId).first();

  const out = {
    id: duel.id,
    status: duel.status,
    questionCount: duel.question_count,
    opponentName,
    myAnswered: myCountRow.n,
    opponentAnswered: oppCountRow.n,
    currentQuestion: null,
    result: null,
  };

  if (duel.status === 'active' && myCountRow.n < duel.question_count) {
    const q = await env.DB.prepare(
      'SELECT position, operand_a, operand_b, operator FROM duel_questions WHERE duel_id = ? AND position = ?'
    ).bind(duelId, myCountRow.n).first();
    if (q) out.currentQuestion = { position: q.position, operandA: q.operand_a, operandB: q.operand_b, operator: q.operator };
  }

  if (duel.status === 'finished') {
    const scoreFor = async (studentId) => {
      const r = await env.DB.prepare('SELECT SUM(is_correct) AS correct FROM duel_answers WHERE duel_id = ? AND student_id = ?')
        .bind(duelId, studentId).first();
      return r.correct || 0;
    };
    const [myScore, oppScore] = await Promise.all([scoreFor(student.id), scoreFor(opponentId)]);
    out.result = {
      myScore, opponentScore: oppScore,
      outcome: duel.winner_id === student.id ? 'win' : (duel.winner_id === opponentId ? 'lose' : 'draw'),
    };
  }

  return json(out);
}
