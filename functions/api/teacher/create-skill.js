import { json, err } from "../_lib/http.js";

export async function onRequestPost({ request, env }) {
  try {
    const user = request.user;

    if (!user || user.role !== "teacher") {
      return err("دسترسی فقط برای معلم است", 403);
    }

    const body = await request.json();

    const subject = String(body.subject || "").trim();
    const grade = body.grade == null ? null : Number(body.grade);
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const description = body.description
      ? String(body.description).trim()
      : null;
    const parentId =
      body.parent_id == null || body.parent_id === ""
        ? null
        : Number(body.parent_id);

    if (!subject || !code || !name) {
      return err("subject، code و name الزامی هستند", 400);
    }

    if (grade !== null && !Number.isInteger(grade)) {
      return err("grade نامعتبر است", 400);
    }

    if (parentId !== null && !Number.isInteger(parentId)) {
      return err("parent_id نامعتبر است", 400);
    }

    const teacher = await env.DB.prepare(`
      SELECT id, school_id
      FROM users
      WHERE id = ? AND role = 'teacher'
      LIMIT 1
    `).bind(user.id).first();

    if (!teacher) {
      return err("معلم پیدا نشد", 404);
    }

    if (parentId !== null) {
      const parent = await env.DB.prepare(`
        SELECT id
        FROM learning_skills
        WHERE id = ?
          AND school_id = ?
          AND is_active = 1
        LIMIT 1
      `).bind(parentId, teacher.school_id).first();

      if (!parent) {
        return err("مهارت والد پیدا نشد", 404);
      }
    }

    const existing = await env.DB.prepare(`
      SELECT id
      FROM learning_skills
      WHERE school_id = ? AND code = ?
      LIMIT 1
    `).bind(teacher.school_id, code).first();

    if (existing) {
      return err("این کد مهارت قبلاً استفاده شده است", 409);
    }

    const maxPosition = await env.DB.prepare(`
      SELECT COALESCE(MAX(position), -1) AS position
      FROM learning_skills
      WHERE school_id = ?
        AND subject = ?
        AND (grade = ? OR (grade IS NULL AND ? IS NULL))
        AND parent_id IS ?
    `).bind(
      teacher.school_id,
      subject,
      grade,
      grade,
      parentId
    ).first();

    const position = Number(maxPosition?.position ?? -1) + 1;

    const result = await env.DB.prepare(`
      INSERT INTO learning_skills (
        school_id,
        subject,
        grade,
        code,
        name,
        description,
        parent_id,
        position,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      teacher.school_id,
      subject,
      grade,
      code,
      name,
      description,
      parentId,
      position
    ).run();

    return json({
      ok: true,
      skill: {
        id: result.meta.last_row_id,
        subject,
        grade,
        code,
        name,
        description,
        parent_id: parentId,
        position
      }
    }, 201);

  } catch (e) {
    console.error("create-skill error:", e);
    return err("خطا در ایجاد مهارت", 500);
  }
}
