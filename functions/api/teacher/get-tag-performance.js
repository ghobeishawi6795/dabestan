import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('classId'));
  if (!classId) return err('classId is required');

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(classId, teacher.id, teacher.school_id).first();
  if (!cls) return err('class not found', 404);

  // فقط پاسخ‌های نمره‌گذاری‌شده (is_correct مشخص) و سؤالاتی که تگ دارن.
  const { results } = await env.DB.prepare(
    `SELECT sa.is_correct, q.tags
     FROM submission_answers sa
     JOIN submissions sub ON sub.id = sa.submission_id
     JOIN users st ON st.id = sub.student_id
     JOIN question_bank q ON q.id = sa.question_id
     WHERE st.class_id = ? AND sa.is_correct IS NOT NULL AND q.tags IS NOT NULL AND q.tags != ''`
  ).bind(classId).all();

  const byTag = new Map();
  for (const row of results) {
    const tags = row.tags.split(',').map((t) => t.trim()).filter(Boolean);
    for (const tag of tags) {
      if (!byTag.has(tag)) byTag.set(tag, { correct: 0, total: 0 });
      const entry = byTag.get(tag);
      entry.total += 1;
      if (row.is_correct) entry.correct += 1;
    }
  }

  const tags = [...byTag.entries()]
    .map(([tag, { correct, total }]) => ({ tag, correct, total, pct: Math.round((correct / total) * 100) }))
    .filter((t) => t.total >= 3) // آماره‌های خیلی کم‌نمونه گمراه‌کننده‌ن
    .sort((a, b) => a.pct - b.pct);

  return json({ tags });
}
