import { json, err } from '../_lib/http.js';
import { checkAndAwardTeacherBadges } from '../_lib/teacher-badges.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');
  const { title, subject, icon, classId, assignmentIds } = body;
  if (!title || !subject || !classId || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
    return err('title, subject, classId, and at least one assignmentId are required');
  }

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ? AND school_id = ?')
    .bind(classId, teacher.id, teacher.school_id).first();
  if (!cls) return err('classId does not belong to this teacher', 400);

  // هر تکلیفی که به این فصل وصل می‌شه باید هم مال همین معلم باشه و هم واقعاً برای همین کلاس فرستاده شده باشه.
  const placeholders = assignmentIds.map(() => '?').join(',');
  const { results: ownedAssignments } = await env.DB.prepare(
    `SELECT id FROM assignments WHERE teacher_id = ? AND school_id = ? AND class_id = ? AND id IN (${placeholders})`
  ).bind(teacher.id, teacher.school_id, classId, ...assignmentIds).all();
  if (ownedAssignments.length !== assignmentIds.length) {
    return err('one or more assignmentIds are invalid for this class/teacher', 400);
  }

  const positionRow = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM lessons WHERE class_id = ?')
    .bind(classId).first();

  const lesson = await env.DB.prepare(
    `INSERT INTO lessons (school_id, teacher_id, class_id, subject, title, icon, position)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(teacher.school_id, teacher.id, classId, subject, title, icon || '📘', positionRow.maxPos + 1).first();

  const inserts = assignmentIds.map((aid, i) =>
    env.DB.prepare('INSERT INTO lesson_assignments (lesson_id, assignment_id, position) VALUES (?, ?, ?)')
      .bind(lesson.id, aid, i)
  );
  await env.DB.batch(inserts);

  const newlyEarnedBadges = await checkAndAwardTeacherBadges(env, teacher.id);
  return json({ ok: true, lessonId: lesson.id, newlyEarnedBadges });
}
