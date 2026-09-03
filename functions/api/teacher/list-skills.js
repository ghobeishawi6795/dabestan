import { json, err } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = request.user;

    if (!user || user.role !== "teacher") {
      return err("دسترسی فقط برای معلم است", 403);
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

    const url = new URL(request.url);

    const subject = url.searchParams.get("subject");
    const gradeParam = url.searchParams.get("grade");

    let sql = `
      SELECT
        id,
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
      WHERE school_id = ?
        AND is_active = 1
    `;

    const params = [teacher.school_id];

    if (subject) {
      sql += ` AND subject = ?`;
      params.push(subject);
    }

    if (gradeParam !== null) {
      const grade = Number(gradeParam);

      if (!Number.isInteger(grade)) {
        return err("grade نامعتبر است", 400);
      }

      sql += ` AND grade = ?`;
      params.push(grade);
    }

    sql += `
      ORDER BY
        subject ASC,
        grade ASC,
        parent_id ASC,
        position ASC,
        id ASC
    `;

    const result = await env.DB.prepare(sql).bind(...params).all();

    return json({
      ok: true,
      skills: result.results || []
    });

  } catch (e) {
    console.error("list-skills error:", e);
    return err("خطا در دریافت مهارت‌ها", 500);
  }
}
