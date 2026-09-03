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
    SELECT *
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

  const subject =
    body.subject !== undefined
      ? String(body.subject).trim()
      : skill.subject;

  const code =
    body.code !== undefined
      ? String(body.code).trim()
      : skill.code;

  const name =
    body.name !== undefined
      ? String(body.name).trim()
      : skill.name;

  const description =
    body.description !== undefined
      ? String(body.description).trim()
      : skill.description;

  const grade =
    body.grade !== undefined &&
    body.grade !== null &&
    body.grade !== ''
      ? Number(body.grade)
      : skill.grade;

  const parentId =
    body.parent_id !== undefined
      ? (
          body.parent_id === null ||
          body.parent_id === ''
            ? null
            : Number(body.parent_id)
        )
      : skill.parent_id;

  const position =
    body.position !== undefined
      ? Number(body.position)
      : skill.position;

  if (!subject || !code || !name) {
    return err('subject, code and name are required');
  }

  if (
    grade !== null &&
    grade !== undefined &&
    (!Number.isInteger(grade) || grade < 0)
  ) {
    return err('invalid grade');
  }

  if (
    parentId !== null &&
    parentId !== undefined &&
    (!Number.isInteger(parentId) || parentId <= 0)
  ) {
    return err('invalid parent_id');
  }

  if (parentId === skillId) {
    return err('skill cannot be its own parent');
  }

  if (parentId) {
    const parent = await env.DB.prepare(`
      SELECT id
      FROM learning_skills
      WHERE id = ?
        AND school_id = ?
        AND is_active = 1
    `).bind(
      parentId,
      teacher.school_id
    ).first();

    if (!parent) {
      return err('parent skill not found', 404);
    }
  }

  const duplicate = await env.DB.prepare(`
    SELECT id
    FROM learning_skills
    WHERE school_id = ?
      AND code = ?
      AND id != ?
  `).bind(
    teacher.school_id,
    code,
    skillId
  ).first();

  if (duplicate) {
    return err('skill code already exists', 409);
  }

  await env.DB.prepare(`
    UPDATE learning_skills
    SET
      subject = ?,
      grade = ?,
      code = ?,
      name = ?,
      description = ?,
      parent_id = ?,
      position = ?
    WHERE id = ?
      AND school_id = ?
  `).bind(
    subject,
    grade,
    code,
    name,
    description || null,
    parentId,
    Number.isInteger(position) ? position : skill.position,
    skillId,
    teacher.school_id
  ).run();

  const updated = await env.DB.prepare(`
    SELECT
      id,
      school_id,
      subject,
      grade,
      code,
      name,
      description,
      parent_id,
      position,
      is_active,
      created_at
    FROM learning_skills
    WHERE id = ?
  `).bind(skillId).first();

  return json({
    ok: true,
    skill: updated
  });
}
