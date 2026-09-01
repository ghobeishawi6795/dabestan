// محاسبهٔ روز پیاپی + بررسی و اعطای نشان — سمت سرور، تا با هر بار ارسال تکلیف به‌روز بمونه.
import { getActiveFestival } from './festival.js';

// روزهای پیاپی فعالیت را از تاریخ‌های submitted_at حساب می‌کند (امروز یا دیروز باید جزوشون باشه تا زنجیره نشکنه).
export async function getStreak(env, studentId) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT date(submitted_at) AS d FROM submissions
     WHERE student_id = ? AND submitted_at IS NOT NULL ORDER BY d DESC`
  ).bind(studentId).all();
  if (!results.length) return 0;

  const dates = results.map((r) => r.d);
  const today = new Date().toISOString().slice(0, 10);
  const oneDayMs = 86400000;
  let cursor = new Date(`${today}T00:00:00Z`);

  // زنجیره باید از امروز یا دیروز شروع بشه، وگرنه streak صفره.
  if (dates[0] !== today) {
    const yesterday = new Date(cursor.getTime() - oneDayMs).toISOString().slice(0, 10);
    if (dates[0] !== yesterday) return 0;
    cursor = new Date(cursor.getTime() - oneDayMs);
  }

  let streak = 0;
  for (const d of dates) {
    const expected = cursor.toISOString().slice(0, 10);
    if (d === expected) { streak++; cursor = new Date(cursor.getTime() - oneDayMs); }
    else if (d < expected) break;
  }
  return streak;
}

const BADGE_CHECKS = {
  first_task: async (env, studentId) => {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM submissions WHERE student_id = ?`).bind(studentId).first();
    return r.n >= 1;
  },
  perfect_score: async (env, studentId) => {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM submissions WHERE student_id = ? AND score = 100`).bind(studentId).first();
    return r.n >= 1;
  },
  ten_tasks: async (env, studentId) => {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM submissions WHERE student_id = ?`).bind(studentId).first();
    return r.n >= 10;
  },
  streak_5: async (env, studentId) => (await getStreak(env, studentId)) >= 5,
  artist: async (env, studentId) => {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM submission_answers sa
       JOIN submissions sub ON sub.id = sa.submission_id
       JOIN question_bank q ON q.id = sa.question_id
       WHERE sub.student_id = ? AND q.question_type IN ('drawing', 'coloring')`
    ).bind(studentId).first();
    return r.n >= 1;
  },
  speaker: async (env, studentId) => {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM submission_answers sa
       JOIN submissions sub ON sub.id = sa.submission_id
       JOIN question_bank q ON q.id = sa.question_id
       WHERE sub.student_id = ? AND q.question_type = 'audio_record'`
    ).bind(studentId).first();
    return r.n >= 1;
  },
  mehregan_1405: async (env, studentId) => {
    const festival = getActiveFestival();
    if (!festival || festival.code !== 'mehregan_1405') return false;
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM submissions WHERE student_id = ? AND date(submitted_at) BETWEEN ? AND ?`
    ).bind(studentId, festival.start, festival.end).first();
    return r.n >= 1;
  },
};

// نشان‌های تازه‌کسب‌شده رو برمی‌گردونه (برای نمایش جشن‌گرفتن توی رابط کاربری)
export async function checkAndAwardBadges(env, studentId) {
  const { results: already } = await env.DB.prepare('SELECT badge_code FROM user_badges WHERE user_id = ?').bind(studentId).all();
  const earnedCodes = new Set(already.map((r) => r.badge_code));
  const newly = [];

  for (const [code, check] of Object.entries(BADGE_CHECKS)) {
    if (earnedCodes.has(code)) continue;
    if (await check(env, studentId)) {
      await env.DB.prepare('INSERT INTO user_badges (user_id, badge_code) VALUES (?, ?)').bind(studentId, code).run();
      newly.push(code);
    }
  }
  return newly;
}
