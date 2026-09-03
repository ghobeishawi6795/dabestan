import { json, err } from '../_lib/http.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';

const MAX_CODE_LEN = 128;
const MAX_COMMENT_LEN = 1000;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);

    const code = String(body?.code || '').trim();
    const submissionId = Number(body?.submissionId);
    const rating = Number(body?.rating);
    const comment =
      body?.comment == null
        ? null
        : String(body.comment).trim().slice(0, MAX_COMMENT_LEN);

    if (!code || !Number.isInteger(submissionId)) {
      return err('code and submissionId are required', 400);
    }

    if (code.length > MAX_CODE_LEN) {
      return err('invalid code', 400);
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return err('rating must be an integer between 1 and 5', 400);
    }

    const student = await env.DB.prepare(`
      SELECT id
      FROM users
      WHERE parent_code = ?
        AND role = 'student'
        AND is_active = 1
      LIMIT 1
    `).bind(code).first();

    if (!student) {
      return err('invalid code', 404);
    }

    const submission = await env.DB.prepare(`
      SELECT
        sub.id,
        a.teacher_id
      FROM submissions sub
      JOIN assignments a ON a.id = sub.assignment_id
      WHERE sub.id = ?
        AND sub.student_id = ?
        AND sub.status = 'reviewed'
      LIMIT 1
    `).bind(submissionId, student.id).first();

    if (!submission) {
      return err('submission not found or not yet reviewed', 404);
    }

    const existing = await env.DB.prepare(`
      SELECT id
      FROM parent_feedback
      WHERE submission_id = ?
      LIMIT 1
    `).bind(submissionId).first();

    if (existing) {
      await env.DB.prepare(`
        UPDATE parent_feedback
        SET rating = ?, comment = ?
        WHERE id = ?
      `).bind(
        rating,
        comment || null,
        existing.id
      ).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO parent_feedback (
          student_id,
          teacher_id,
          submission_id,
          rating,
          comment
        )
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        student.id,
        submission.teacher_id,
        submissionId,
        rating,
        comment || null
      ).run();
    }

    await checkAndAwardTeacherBadges(env, submission.teacher_id);

    return json({
      ok: true,
      submissionId,
      rating,
      comment: comment || null
    });
  } catch (e) {
    console.error('parent submit-feedback error:', e);
    return err('خطا در ثبت بازخورد والد', 500);
  }
}
