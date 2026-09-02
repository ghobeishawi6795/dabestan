import { json, err } from '../_lib/http.js';
import { CUSTOM_HTML_MAX_CHARS } from '../_lib/grading.js';

const VALID_TYPES = [
  'multiple_choice', 'true_false', 'matching', 'ordering', 'fill_blank',
  'drawing', 'coloring', 'audio_record', 'photo_upload', 'drag_connect', 'custom_html',
];

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.questionId || !body?.title || !body?.questionType || !body?.content) {
    return err('questionId, title, questionType, content are required');
  }
  if (!VALID_TYPES.includes(body.questionType)) return err('invalid questionType');
  if (body.difficulty && !['easy', 'medium', 'hard'].includes(body.difficulty)) return err('invalid difficulty');
  if (body.status && !['draft', 'active', 'archived'].includes(body.status)) return err('invalid status');
  const tagsStr = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).join(',') : (body.tags || null);

  if (body.questionType === 'custom_html') {
    if (!body.customHtml || !body.customHtml.trim()) return err('customHtml is required for this question type');
    if (body.customHtml.length > CUSTOM_HTML_MAX_CHARS) return err(`customHtml exceeds ${CUSTOM_HTML_MAX_CHARS} characters`, 400);
  }

  const question = await env.DB.prepare('SELECT id, version FROM question_bank WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(body.questionId, teacher.id, teacher.school_id).first();
  if (!question) return err('question not found', 404);

  let contentJson;
  try {
    contentJson = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
    JSON.parse(contentJson);
  } catch {
    return err('content must be valid JSON');
  }

  const nextVersion = (question.version || 1) + 1;

  await env.DB.prepare(
    `UPDATE question_bank SET title = ?, question_type = ?, subject = ?, grade = ?, content_json = ?, custom_html = ?, tags = ?, difficulty = ?,
     chapter = ?, topic = ?, explanation = ?, status = COALESCE(?, status), version = ? WHERE id = ?`
  ).bind(
    body.title, body.questionType, body.subject || null, body.grade || null, contentJson, body.customHtml || null,
    tagsStr || null, body.difficulty || null, body.chapter || null, body.topic || null, body.explanation || null,
    body.status || null, nextVersion, body.questionId
  ).run();

  await env.DB.prepare(
    'INSERT OR REPLACE INTO question_versions (question_id, version, title, content_json, custom_html) VALUES (?, ?, ?, ?, ?)'
  ).bind(body.questionId, nextVersion, body.title, contentJson, body.customHtml || null).run();

  return json({ ok: true, version: nextVersion });
}
