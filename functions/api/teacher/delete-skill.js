import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const teacher = request.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('teacher access required', 403);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return err('invalid JSON');
  }

  const skillId = Number(body?.skill_id);

  if (!Number.isInteger(skillId) || skillId <= 0) {
    return err('skill_id is required');
  }

  const skill = await env.DB.prepare(`
    SELECT id, name, parent_id
    FROM learning_skills
    WHERE id = ?
      AND school_id = ?
  `).bind(
    skillId,
    teacher.school_id
  ).first();

  if (!skill) {
    return err('skill not found', 404);
  }

  const childCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM learning_skills
    WHERE parent_id = ?
      AND school_id = ?
      AND is_active = 1
  `).bind(
    skillId,
    teacher.school_id
  ).first();

  if (Number(childCount?.count || 0) > 0) {
    return err(
      'این مهارت دارای زیرمهارت فعال است؛ ابتدا زیرمهارت‌ها را مدیریت کنید',
      409
    );
  }

  await env.DB.prepare(`
    UPDATE learning_skills
    SET is_active = 0
    WHERE id = ?
      AND school_id = ?
  `).bind(
    skillId,
    teacher.school_id
  ).run();

  return json({
    ok: true,
    skillId,
    deactivated: true
  });
}
