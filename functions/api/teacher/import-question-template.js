import { json, err } from '../_lib/http.js';
import { getTemplatePack } from '../_lib/question-templates.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  const packId = body?.packId;
  if (!packId) return err('packId is required');

  const pack = getTemplatePack(packId);
  if (!pack) return err('template pack not found', 404);

  // هر سؤال بستهٔ نمونه دقیقاً مثل add-question.js ذخیره می‌شه — یه ردیف واقعی و مستقل
  // توی بانک خود معلم، تا از همون لحظه قابل ویرایش/حذف باشه، هیچ ارجاعی به «قالب» نگه‌داشته نمی‌شه.
  let added = 0;
  for (const q of pack.questions) {
    const tagsStr = Array.isArray(q.tags) ? q.tags.join(',') : (q.tags || null);
    await env.DB.prepare(
      `INSERT INTO question_bank (school_id, teacher_id, question_type, subject, grade, title, content_json, tags, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      teacher.school_id, teacher.id, q.questionType, pack.subject, pack.grade, q.title,
      JSON.stringify(q.content), tagsStr, q.difficulty || null
    ).run();
    added++;
  }

  const newlyEarnedBadges = await checkAndAwardTeacherBadges(env, teacher.id);
  return json({ ok: true, added, newlyEarnedBadges });
}
