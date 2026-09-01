import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId) return err('assignmentId is required');

  const school = await env.DB.prepare('SELECT skip_cards_enabled FROM schools WHERE id = ?').bind(student.school_id).first();
  if (!school?.skip_cards_enabled) return err('skip cards are disabled for this school', 403);

  const assignment = await env.DB.prepare(
    'SELECT id FROM assignments WHERE id = ? AND school_id = ? AND class_id = ?'
  ).bind(body.assignmentId, student.school_id, student.class_id).first();
  if (!assignment) return err('assignment not found', 404);

  const existing = await env.DB.prepare(
    'SELECT id, status FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(body.assignmentId, student.id).first();
  if (existing && existing.status !== 'in_progress') {
    return err('this assignment was already submitted or reviewed and can no longer be excused', 409);
  }

  // یک اعتبار مصرف‌نشده رو قفل می‌کنیم (UPDATE شرطی، نه SELECT-then-UPDATE، تا با درخواست هم‌زمان دوبار مصرف نشه).
  const credit = await env.DB.prepare(
    `SELECT id FROM shop_purchases WHERE student_id = ? AND item_type = 'skip_card' AND used_at IS NULL LIMIT 1`
  ).bind(student.id).first();
  if (!credit) return err('no unused skip card', 403);

  const now = new Date().toISOString();
  const locked = await env.DB.prepare(
    `UPDATE shop_purchases SET used_at = ? WHERE id = ? AND used_at IS NULL`
  ).bind(now, credit.id).run();
  if (!locked.meta || locked.meta.changes === 0) return err('no unused skip card', 403);

  if (existing) {
    await env.DB.prepare(`UPDATE submissions SET status = 'reviewed', score = NULL, excused = 1, submitted_at = ?, reviewed_at = ? WHERE id = ?`)
      .bind(now, now, existing.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO submissions (assignment_id, student_id, status, score, excused, submitted_at, reviewed_at)
       VALUES (?, ?, 'reviewed', NULL, 1, ?, ?)`
    ).bind(body.assignmentId, student.id, now, now).run();
  }

  const skipCreditsRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM shop_purchases WHERE student_id = ? AND item_type = 'skip_card' AND used_at IS NULL`
  ).bind(student.id).first();

  return json({ ok: true, skipCredits: skipCreditsRow.n });
}
