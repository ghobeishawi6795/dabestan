import { json, err } from '../_lib/http.js';

// برچسب هفتهٔ ایزو (yyyy-Www) برای یه تاریخ — برای دسته‌بندی روند در طول زمان.
function isoWeekLabel(dateInput) {
  const d = new Date(dateInput);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // دوشنبه = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const questionId = Number(url.searchParams.get('questionId'));
  if (!questionId) return err('questionId is required');

  // هر معلمی توی همون مدرسه می‌تونه آمار رو ببینه (همون سطح نمایشی که توی «بانک مدرسه» هم هست) —
  // ولی فقط صاحب سؤال می‌تونه ویرایش/بازگردانی کنه (توی endpointهای دیگه چک می‌شه).
  const q = await env.DB.prepare('SELECT id, title FROM question_bank WHERE id = ? AND school_id = ?')
    .bind(questionId, teacher.school_id).first();
  if (!q) return err('question not found', 404);

  const totals = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM assignment_questions WHERE question_id = ?) AS usageCount,
      (SELECT COUNT(*) FROM submission_answers WHERE question_id = ?) AS answerCount,
      (SELECT ROUND(AVG(is_correct) * 100) FROM submission_answers WHERE question_id = ? AND is_correct IS NOT NULL) AS successRate`
  ).bind(questionId, questionId, questionId).first();

  const { results: rows } = await env.DB.prepare(
    `SELECT sub.submitted_at AS submittedAt, sa.is_correct AS isCorrect, c.name AS className
     FROM submission_answers sa
     JOIN submissions sub ON sub.id = sa.submission_id
     JOIN users st ON st.id = sub.student_id
     LEFT JOIN classes c ON c.id = st.class_id
     WHERE sa.question_id = ? AND sub.submitted_at IS NOT NULL AND sa.is_correct IS NOT NULL
     ORDER BY sub.submitted_at ASC`
  ).bind(questionId).all();

  const byWeek = new Map();
  const byClass = new Map();
  for (const r of rows) {
    const week = isoWeekLabel(r.submittedAt);
    if (!byWeek.has(week)) byWeek.set(week, { correct: 0, total: 0 });
    const we = byWeek.get(week);
    we.total += 1;
    if (r.isCorrect) we.correct += 1;

    const className = r.className || 'بدون کلاس';
    if (!byClass.has(className)) byClass.set(className, { correct: 0, total: 0 });
    const ce = byClass.get(className);
    ce.total += 1;
    if (r.isCorrect) ce.correct += 1;
  }

  const trend = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, { correct, total }]) => ({ week, pct: Math.round((correct / total) * 100), total }));

  const byClassArr = [...byClass.entries()]
    .map(([className, { correct, total }]) => ({ className, correct, total, pct: Math.round((correct / total) * 100) }))
    .sort((a, b) => b.total - a.total);

  return json({
    questionId,
    title: q.title,
    usageCount: totals.usageCount || 0,
    answerCount: totals.answerCount || 0,
    successRate: totals.successRate,
    trend,
    byClass: byClassArr,
  });
}
