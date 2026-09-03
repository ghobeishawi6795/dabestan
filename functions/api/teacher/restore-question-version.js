import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.questionId || !body?.version) return err('questionId and version are required');

  const question = await env.DB.prepare('SELECT id, version FROM question_bank WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(body.questionId, teacher.id, teacher.school_id).first();
  if (!question) return err('question not found', 404);

  const oldVersion = await env.DB.prepare(
    'SELECT title, content_json, custom_html FROM question_versions WHERE question_id = ? AND version = ?'
  ).bind(body.questionId, body.version).first();
  if (!oldVersion) return err('version not found', 404);

  // بازگردانی خودش به‌عنوان یه نسخهٔ جدید ثبت می‌شه (نه rewrite تاریخچه) — تا خط زمانی همیشه دست‌نخورده بمونه.
  // توجه: فقط عنوان/متن سؤال/HTML سفارشی بازگردانی می‌شه، چون فقط همینا توی question_versions اسنپ‌شات می‌شن؛
  // موضوع/پایه/برچسب‌ها/وضعیت و بقیهٔ متادیتا نسخه‌بندی نشدن و تغییر نمی‌کنن.
  const nextVersion = (question.version || 1) + 1;

  await env.DB.prepare(
    'UPDATE question_bank SET title = ?, content_json = ?, custom_html = ?, version = ? WHERE id = ?'
  ).bind(oldVersion.title, oldVersion.content_json, oldVersion.custom_html, nextVersion, body.questionId).run();

  await env.DB.prepare(
    'INSERT OR REPLACE INTO question_versions (question_id, version, title, content_json, custom_html) VALUES (?, ?, ?, ?, ?)'
  ).bind(body.questionId, nextVersion, oldVersion.title, oldVersion.content_json, oldVersion.custom_html).run();

  return json({ ok: true, version: nextVersion });
}
