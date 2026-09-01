import { json, err } from '../_lib/http.js';

// کارت‌های کلکسیونی چیز جدیدی نیستن — از تگ‌های سؤالاتی که دانش‌آموز درست جواب داده مشتق می‌شن،
// پس هیچ جدول تازه‌ای لازم نیست. رنگ‌بندی بر اساس تعداد دفعات کسب همون تگه (بیشتر = کمیاب‌تر به نظر نمی‌رسه
// بلکه یعنی مهارتش قوی‌تره؛ اینجا برعکسِ کمیابی معمول عمل می‌کنه: تکرار کم = تازه‌کسب‌شده = برنزی).
function rarityFor(count) {
  if (count >= 10) return { label: 'طلایی', tier: 'gold' };
  if (count >= 4) return { label: 'نقره‌ای', tier: 'silver' };
  return { label: 'برنزی', tier: 'bronze' };
}

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT q.tags AS tags FROM submission_answers sa
     JOIN submissions sub ON sub.id = sa.submission_id
     JOIN question_bank q ON q.id = sa.question_id
     WHERE sub.student_id = ? AND sa.is_correct = 1 AND q.tags IS NOT NULL AND q.tags != ''`
  ).bind(student.id).all();

  const counts = new Map();
  for (const row of results) {
    for (const rawTag of row.tags.split(',')) {
      const tag = rawTag.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const cards = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, ...rarityFor(count) }))
    .sort((a, b) => b.count - a.count);

  return json({ cards });
}
