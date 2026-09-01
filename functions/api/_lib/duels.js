// نبرد ریاضی: تولید سؤال + جمع‌بندی نتیجه — جدا شده تا هم respond-duel و هم answer-duel ازش استفاده کنن.
import { notify } from './notify.js';
import { checkAndAwardBadges } from './badges.js';

const OPERATORS = ['+', '-', '×'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// یک سؤال ضرب‌وجمع‌وتفریق ساده می‌سازه — مناسب دورهٔ ابتدایی، همیشه جواب نامنفی.
function makeQuestion() {
  const operator = OPERATORS[randInt(0, OPERATORS.length - 1)];
  if (operator === '×') {
    const a = randInt(2, 12), b = randInt(2, 12);
    return { operandA: a, operandB: b, operator, answer: a * b };
  }
  if (operator === '-') {
    const a = randInt(5, 50), b = randInt(1, a); // تضمین نتیجهٔ نامنفی
    return { operandA: a, operandB: b, operator, answer: a - b };
  }
  const a = randInt(1, 50), b = randInt(1, 50);
  return { operandA: a, operandB: b, operator, answer: a + b };
}

// وقتی حریف دعوت رو قبول می‌کنه صدا زده می‌شه — همون ست سؤال برای هر دو نفر.
export async function generateDuelQuestions(env, duelId, count) {
  const inserts = [];
  for (let i = 0; i < count; i++) {
    const q = makeQuestion();
    inserts.push(
      env.DB.prepare(
        'INSERT INTO duel_questions (duel_id, position, operand_a, operand_b, operator, answer) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(duelId, i, q.operandA, q.operandB, q.operator, q.answer)
    );
  }
  await env.DB.batch(inserts);
}

// اگه هر دو نفر همهٔ سؤالا رو جواب داده باشن، نبرد رو جمع‌بندی می‌کنه: برنده/مساوی + سکه + اعلان + نشان.
// امن در برابر دو فراخوانی هم‌زمان: finished_at IS NULL توی شرط UPDATE، پس فقط یکی برنده می‌شه توی race.
export async function tryFinalizeDuel(env, duel) {
  const countFor = async (studentId) => {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM duel_answers WHERE duel_id = ? AND student_id = ?')
      .bind(duel.id, studentId).first();
    return r.n;
  };
  const [challengerCount, opponentCount] = await Promise.all([
    countFor(duel.challenger_id), countFor(duel.opponent_id),
  ]);
  if (challengerCount < duel.question_count || opponentCount < duel.question_count) return null;

  const scoreFor = async (studentId) => {
    const r = await env.DB.prepare(
      `SELECT SUM(is_correct) AS correct, MAX(answered_at) AS lastAt FROM duel_answers WHERE duel_id = ? AND student_id = ?`
    ).bind(duel.id, studentId).first();
    return { correct: r.correct || 0, lastAt: r.lastAt };
  };
  const [challengerScore, opponentScore] = await Promise.all([
    scoreFor(duel.challenger_id), scoreFor(duel.opponent_id),
  ]);

  let winnerId = null;
  if (challengerScore.correct !== opponentScore.correct) {
    winnerId = challengerScore.correct > opponentScore.correct ? duel.challenger_id : duel.opponent_id;
  } else if (challengerScore.lastAt !== opponentScore.lastAt) {
    // مساوی از نظر تعداد درست — کسی که زودتر تمام کرده برنده‌ست
    winnerId = challengerScore.lastAt < opponentScore.lastAt ? duel.challenger_id : duel.opponent_id;
  } // else: مساوی واقعی، winnerId می‌مونه null

  const result = await env.DB.prepare(
    `UPDATE duels SET status = 'finished', finished_at = datetime('now'), winner_id = ?
     WHERE id = ? AND status = 'active' AND finished_at IS NULL`
  ).bind(winnerId, duel.id).run();
  if (!result.meta.changes) return null; // یه فراخوانی هم‌زمان دیگه زودتر finalize کرد

  const loserId = winnerId ? (winnerId === duel.challenger_id ? duel.opponent_id : duel.challenger_id) : null;
  const coinUpdates = [];
  if (winnerId) {
    coinUpdates.push(env.DB.prepare('UPDATE users SET coins = coins + 15 WHERE id = ?').bind(winnerId));
    coinUpdates.push(env.DB.prepare('UPDATE users SET coins = coins + 5 WHERE id = ?').bind(loserId));
  } else {
    coinUpdates.push(env.DB.prepare('UPDATE users SET coins = coins + 10 WHERE id = ?').bind(duel.challenger_id));
    coinUpdates.push(env.DB.prepare('UPDATE users SET coins = coins + 10 WHERE id = ?').bind(duel.opponent_id));
  }
  await env.DB.batch(coinUpdates);

  const resultText = winnerId
    ? `نتیجه: ${challengerScore.correct}-${opponentScore.correct}`
    : `مساوی شدید: ${challengerScore.correct}-${opponentScore.correct}`;
  await notify(env, duel.challenger_id, 'duel_result', 'نبرد ریاضی تمام شد ⚔️', resultText, duel.id);
  await notify(env, duel.opponent_id, 'duel_result', 'نبرد ریاضی تمام شد ⚔️', resultText, duel.id);

  const newlyEarnedBadges = {};
  if (winnerId) {
    newlyEarnedBadges[winnerId] = await checkAndAwardBadges(env, winnerId);
  }

  return { winnerId, challengerScore, opponentScore, newlyEarnedBadges };
}
