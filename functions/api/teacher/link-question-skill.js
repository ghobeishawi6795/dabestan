import { json, err } from "../_lib/http.js";

export async function onRequestPost({ request, env }) {
  try {
    const user = request.user;

    if (!user || user.role !== "teacher") {
      return err("دسترسی فقط برای معلم است", 403);
    }

    const body = await request.json();

    const questionId = Number(body.question_id);
    const skillId = Number(body.skill_id);
    const weight =
      body.weight == null ? 1 : Number(body.weight);

    if (!Number.isInteger(questionId) || !Number.isInteger(skillId)) {
      return err("question_id و skill_id الزامی هستند", 400);
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      return err("weight نامعتبر است", 400);
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

    const question = await env.DB.prepare(`
      SELECT id
      FROM question_bank
      WHERE id = ?
        AND school_id = ?
        AND teacher_id = ?
      LIMIT 1
    `).bind(
      questionId,
      teacher.school_id,
      teacher.id
    ).first();

    if (!question) {
      return err("سؤال پیدا نشد یا متعلق به شما نیست", 404);
    }

    const skill = await env.DB.prepare(`
      SELECT id
      FROM learning_skills
      WHERE id = ?
        AND school_id = ?
        AND is_active = 1
      LIMIT 1
    `).bind(
      skillId,
      teacher.school_id
    ).first();

    if (!skill) {
      return err("مهارت پیدا نشد", 404);
    }

    await env.DB.prepare(`
      INSERT INTO question_skills (
        question_id,
        skill_id,
        weight
      )
      VALUES (?, ?, ?)
      ON CONFLICT(question_id, skill_id)
      DO UPDATE SET weight = excluded.weight
    `).bind(
      questionId,
      skillId,
      weight
    ).run();

    return json({
      ok: true,
      question_id: questionId,
      skill_id: skillId,
      weight
    });

  } catch (e) {
    console.error("link-question-skill error:", e);
    return err("خطا در اتصال سؤال به مهارت", 500);
  }
}
