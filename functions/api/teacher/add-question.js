import { json, err } from '../_lib/http.js';
import { CUSTOM_HTML_MAX_CHARS } from '../_lib/grading.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';

const VALID_TYPES = [
  'multiple_choice', 'true_false', 'matching', 'ordering', 'fill_blank',
  'drawing', 'coloring', 'audio_record', 'photo_upload', 'drag_connect', 'custom_html',
];

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { title, questionType, subject, grade, content, customHtml, tags, difficulty, chapter, topic, explanation, status, visibility } = body;
  if (!title || !questionType || !content) return err('title, questionType, content are required');
  if (!VALID_TYPES.includes(questionType)) return err('invalid questionType');
  if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) return err('invalid difficulty');
  if (status && !['draft', 'active', 'archived'].includes(status)) return err('invalid status');
  if (visibility && !['private', 'public'].includes(visibility)) return err('invalid visibility');
  const tagsStr = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).join(',') : (tags || null);

  if (questionType === 'custom_html') {
    if (!customHtml || !customHtml.trim()) return err('customHtml is required for this question type');
    if (customHtml.length > CUSTOM_HTML_MAX_CHARS) return err(`customHtml exceeds ${CUSTOM_HTML_MAX_CHARS} characters`, 400);
  }

  let contentJson;
  try {
    contentJson = typeof content === 'string' ? content : JSON.stringify(content);
    JSON.parse(contentJson);
  } catch {
    return err('content must be valid JSON');
  }

  const result = await env.DB.prepare(
    `INSERT INTO question_bank (school_id, teacher_id, question_type, subject, grade, title, content_json, custom_html, tags, difficulty, chapter, topic, explanation, status, visibility, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`
  ).bind(
    teacher.school_id, teacher.id, questionType, subject || null, grade || null, title, contentJson, customHtml || null,
    tagsStr || null, difficulty || null, chapter || null, topic || null, explanation || null, status || 'active', visibility || 'private'
  ).first();

  await env.DB.prepare(
    'INSERT INTO question_versions (question_id, version, title, content_json, custom_html) VALUES (?, 1, ?, ?, ?)'
  ).bind(result.id, title, contentJson, customHtml || null).run();

  const newlyEarnedBadges = await checkAndAwardTeacherBadges(env, teacher.id);
  return json({ ok: true, questionId: result.id, version: 1, newlyEarnedBadges });
}
