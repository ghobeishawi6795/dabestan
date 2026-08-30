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

  const { title, questionType, subject, grade, content, customHtml } = body;
  if (!title || !questionType || !content) return err('title, questionType, content are required');
  if (!VALID_TYPES.includes(questionType)) return err('invalid questionType');

  if (questionType === 'custom_html') {
    if (!customHtml || !customHtml.trim()) return err('customHtml is required for this question type');
    if (customHtml.length > CUSTOM_HTML_MAX_CHARS) return err(`customHtml exceeds ${CUSTOM_HTML_MAX_CHARS} characters`, 400);
  }

  // content must be valid JSON (structure varies by type; validated fully by the task-runtime grader later).
  let contentJson;
  try {
    contentJson = typeof content === 'string' ? content : JSON.stringify(content);
    JSON.parse(contentJson);
  } catch {
    return err('content must be valid JSON');
  }

  const result = await env.DB.prepare(
    `INSERT INTO question_bank (school_id, teacher_id, question_type, subject, grade, title, content_json, custom_html)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    teacher.school_id, teacher.id, questionType, subject || null, grade || null, title, contentJson, customHtml || null
  ).first();

  const newlyEarnedBadges = await checkAndAwardTeacherBadges(env, teacher.id);
  return json({ ok: true, questionId: result.id, newlyEarnedBadges });
}
