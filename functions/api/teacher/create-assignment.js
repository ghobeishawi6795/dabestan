import { json, err } from '../_lib/http.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';
import { notifyClass } from '../_lib/notify.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { title, description, classId, dueAt, questionIds } = body;
  if (!title || !classId || !Array.isArray(questionIds) || questionIds.length === 0) {
    return err('title, classId, and at least one questionId are required');
  }

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(classId, teacher.id, teacher.school_id)
    .first();
  if (!cls) return err('classId does not belong to this teacher', 400);

  // Verify every question belongs to this school — prevents pulling another school's bank content into a task
  // (this was an IDOR gap in an earlier version of this project; fixed here from the start).
  const placeholders = questionIds.map(() => '?').join(',');
  const { results: ownedQuestions } = await env.DB.prepare(
    `SELECT id FROM question_bank WHERE school_id = ? AND id IN (${placeholders})`
  ).bind(teacher.school_id, ...questionIds).all();
  if (ownedQuestions.length !== questionIds.length) {
    return err('one or more questionIds are invalid for this school', 400);
  }

  const assignment = await env.DB.prepare(
    `INSERT INTO assignments (school_id, teacher_id, class_id, title, description, due_at)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(teacher.school_id, teacher.id, classId, title, description || null, dueAt || null).first();

  // نسخهٔ فعلی هر سؤال رو پین می‌کنیم تا ویرایش‌های بعدی، تکلیف قبلی رو تغییر نده
  const { results: versionRows } = await env.DB.prepare(
    `SELECT id, version FROM question_bank WHERE school_id = ? AND id IN (${questionIds.map(() => '?').join(',')})`
  ).bind(teacher.school_id, ...questionIds).all();
  const versionMap = new Map(versionRows.map((r) => [r.id, r.version || 1]));

  const inserts = questionIds.map((qid, i) =>
    env.DB.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position, pinned_version) VALUES (?, ?, ?, ?)')
      .bind(assignment.id, qid, i, versionMap.get(qid) || 1)
  );
  await env.DB.batch(inserts);

  await notifyClass(env, classId, 'new_assignment', 'تکلیف جدید', `${title}`, assignment.id);

  const newlyEarnedBadges = await checkAndAwardTeacherBadges(env, teacher.id);
  return json({ ok: true, assignmentId: assignment.id, newlyEarnedBadges });
}
