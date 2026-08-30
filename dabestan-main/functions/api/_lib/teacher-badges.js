// نشان‌های معلم — همون الگوی badges.js دانش‌آموز، فقط با معیارهای مخصوص معلم.
// از همون جدول‌های badges/user_badges استفاده می‌کنه چون role-specific نیستن.

const TEACHER_BADGE_CHECKS = {
  first_assignment: async (env, teacherId) => {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM assignments WHERE teacher_id = ?').bind(teacherId).first();
    return r.n >= 1;
  },
  ten_assignments: async (env, teacherId) => {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM assignments WHERE teacher_id = ?').bind(teacherId).first();
    return r.n >= 10;
  },
  quick_grader: async (env, teacherId) => {
    const r = await env.DB.prepare(
      `SELECT AVG((julianday(sub.reviewed_at) - julianday(sub.submitted_at)) * 24) AS avgHours, COUNT(*) AS n
       FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
       WHERE a.teacher_id = ? AND sub.status = 'reviewed' AND sub.reviewed_at IS NOT NULL AND sub.submitted_at IS NOT NULL`
    ).bind(teacherId).first();
    return r.n >= 5 && r.avgHours !== null && r.avgHours <= 24;
  },
  creative_bank: async (env, teacherId) => {
    const r = await env.DB.prepare('SELECT COUNT(DISTINCT question_type) AS n FROM question_bank WHERE teacher_id = ?').bind(teacherId).first();
    return r.n >= 5;
  },
  popular_teacher: async (env, teacherId) => {
    const r = await env.DB.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM parent_feedback WHERE teacher_id = ?').bind(teacherId).first();
    return r.n >= 5 && r.avg !== null && r.avg >= 4.5;
  },
  lesson_builder: async (env, teacherId) => {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM lessons WHERE teacher_id = ?').bind(teacherId).first();
    return r.n >= 1;
  },
};

export const TEACHER_BADGE_CODES = Object.keys(TEACHER_BADGE_CHECKS);

// نشان‌های تازه‌کسب‌شده رو برمی‌گردونه
export async function checkAndAwardTeacherBadges(env, teacherId) {
  const { results: already } = await env.DB.prepare('SELECT badge_code FROM user_badges WHERE user_id = ?').bind(teacherId).all();
  const earnedCodes = new Set(already.map((r) => r.badge_code));
  const newly = [];

  for (const [code, check] of Object.entries(TEACHER_BADGE_CHECKS)) {
    if (earnedCodes.has(code)) continue;
    if (await check(env, teacherId)) {
      await env.DB.prepare('INSERT INTO user_badges (user_id, badge_code) VALUES (?, ?)').bind(teacherId, code).run();
      newly.push(code);
    }
  }
  return newly;
}
