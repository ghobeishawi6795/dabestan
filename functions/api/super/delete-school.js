import { json, err } from '../_lib/http.js';

// Full cascade delete of a school and every row scoped to it.
// schema.sql has PRAGMA foreign_keys = ON, so statements must run leaf-first.
// users.class_id -> classes(id) and classes.teacher_id -> users(id) form a
// cycle, so users.class_id is nulled out first to break it before classes
// (and, transitively, the users who taught them) are removed.
export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.schoolId) return err('schoolId required');
  const schoolId = body.schoolId;

  if (schoolId === user.school_id) {
    return err('نمی‌توانید مدرسهٔ ستاد خودتان را حذف کنید', 400);
  }

  const school = await env.DB.prepare('SELECT id, name FROM schools WHERE id = ?').bind(schoolId).first();
  if (!school) return err('school not found', 404);

  if (!body.confirmName || body.confirmName.trim() !== school.name) {
    return err('نام مدرسه برای تأیید حذف مطابقت ندارد', 400);
  }

  const db = env.DB;
  const stmts = [
    // Break the users<->classes FK cycle before either side is deleted.
    db.prepare('UPDATE users SET class_id = NULL WHERE school_id = ?').bind(schoolId),

    // --- leaf tables, scoped through their parent chain up to this school ---
    db.prepare(`DELETE FROM submission_answers WHERE submission_id IN
      (SELECT id FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id = ?))`).bind(schoolId),
    db.prepare(`DELETE FROM parent_feedback WHERE student_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM lesson_assignments WHERE lesson_id IN (SELECT id FROM lessons WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM due_soon_reminders_sent WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM assignment_questions WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM question_versions WHERE question_id IN (SELECT id FROM question_bank WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM duel_questions WHERE duel_id IN (SELECT id FROM duels WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM duel_answers WHERE duel_id IN (SELECT id FROM duels WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM challenge_participants WHERE challenge_id IN (SELECT id FROM daily_challenges WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM high_fives WHERE from_student_id IN (SELECT id FROM users WHERE school_id = ?) OR to_student_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId, schoolId),
    db.prepare(`DELETE FROM parent_notes WHERE student_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM parent_messages WHERE student_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM pets WHERE student_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM shop_purchases WHERE student_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM user_badges WHERE user_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare(`DELETE FROM daily_rewards WHERE user_id IN (SELECT id FROM users WHERE school_id = ?)`).bind(schoolId),
    db.prepare('DELETE FROM messages WHERE school_id = ?').bind(schoolId),

    // --- mid-level tables ---
    db.prepare(`DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id = ?)`).bind(schoolId),
    db.prepare('DELETE FROM assignments WHERE school_id = ?').bind(schoolId),
    db.prepare('DELETE FROM lessons WHERE school_id = ?').bind(schoolId),
    db.prepare('DELETE FROM duels WHERE school_id = ?').bind(schoolId),
    db.prepare('DELETE FROM daily_challenges WHERE school_id = ?').bind(schoolId),
    db.prepare('DELETE FROM assignment_templates WHERE school_id = ?').bind(schoolId),
    db.prepare('DELETE FROM question_bank WHERE school_id = ?').bind(schoolId),

    // --- classes (now unreferenced by users, assignments, lessons, duels) ---
    db.prepare('DELETE FROM classes WHERE school_id = ?').bind(schoolId),

    // --- users (now unreferenced by classes, since classes rows are gone) ---
    db.prepare('DELETE FROM users WHERE school_id = ?').bind(schoolId),

    // --- the school itself ---
    db.prepare('DELETE FROM schools WHERE id = ?').bind(schoolId),
  ];

  await db.batch(stmts);

  return json({ ok: true, deletedSchoolId: schoolId, deletedSchoolName: school.name });
}
