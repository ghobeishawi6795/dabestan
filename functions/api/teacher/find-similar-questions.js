import { json, err } from '../_lib/http.js';
import { normalizeSearchText } from '../_lib/search-normalize.js';

// شباهت دو عنوان رو با Jaccard روی مجموعهٔ کلمات نرمال‌شده حساب می‌کنه.
// ساده و سریعه، نیاز به کتابخونهٔ خارجی نداره، و برای عنوان‌های کوتاه (چند کلمه) کافیه.
function tokenize(text) {
  return normalizeSearchText(text).split(/[^a-z0-9\u0600-\u06ff]+/).filter(Boolean);
}

function jaccard(tokensA, tokensB) {
  const a = new Set(tokensA), b = new Set(tokensB);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const SIMILARITY_THRESHOLD = 0.4;

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.title || !body.title.trim()) return err('title is required');

  const excludeId = body.excludeId ? Number(body.excludeId) : 0;
  const targetTokens = tokenize(body.title);
  if (!targetTokens.length) return json({ matches: [] });

  // کل بانک مدرسه (همهٔ معلم‌ها) رو کاندید می‌کنیم، نه فقط سؤال‌های خود معلم —
  // چون تکراری‌بودن بین معلم‌های مختلف هم برای مدیر بانک مفیده.
  const { results } = await env.DB.prepare(
    `SELECT q.id, q.title, q.subject, q.grade, q.question_type, q.teacher_id, t.full_name AS author_name
     FROM question_bank q JOIN users t ON t.id = q.teacher_id
     WHERE q.school_id = ? AND q.status != 'archived' AND q.id != ?
     LIMIT 500`
  ).bind(teacher.school_id, excludeId).all();

  const matches = results
    .map((r) => ({ row: r, similarity: jaccard(targetTokens, tokenize(r.title)) }))
    .filter((m) => m.similarity >= SIMILARITY_THRESHOLD)
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, 5)
    .map(({ row, similarity }) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      grade: row.grade,
      questionType: row.question_type,
      isMine: row.teacher_id === teacher.id,
      authorName: row.author_name,
      similarityPct: Math.round(similarity * 100),
    }));

  return json({ matches });
}
