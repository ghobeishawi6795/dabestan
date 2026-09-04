import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const teacher = data.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('forbidden', 403);
  }

  const body = await request.json().catch(() => null);

  const classId = Number(body?.class_id);
  const studentId = Number(body?.student_id);
  const title = String(body?.title || '').trim();
  const dueDate = body?.due_date || null;
  const limit = Math.min(Math.max(Number(body?.limit || 5), 1), 20);

  if (!classId || !studentId || !title) {
    return err('class_id, student_id و title الزامی هستند');
  }

  const student = await env.DB.prepare(`
    SELECT id, school_id, class_id
    FROM users
    WHERE id = ? AND role = 'student'
  `).bind(studentId).first();

  if (
    !student ||
    student.school_id !== teacher.school_id ||
    Number(student.class_id) !== classId
  ) {
    return err('student not found', 404);
  }

  const cls = await env.DB.prepare(`
    SELECT id
    FROM classes
    WHERE id = ? AND school_id = ? AND teacher_id = ?
  `).bind(classId, teacher.school_id, teacher.id).first();

  if (!cls) {
    return err('class not found', 404);
  }

  const { results: weakSkills } = await env.DB.prepare(`
    SELECT
      ls.id,
      ls.name,
      ls.subject,
      ls.code,
      COALESCE(
        SUM(ssr.correct_count) * 100.0 /
        NULLIF(SUM(ssr.answer_count), 0),
        0
      ) AS mastery
    FROM learning_skills ls
    LEFT JOIN student_skill_results ssr
      ON ssr.skill_id = ls.id
     AND ssr.student_id = ?
    WHERE ls.school_id = ?
      AND ls.is_active = 1
    GROUP BY ls.id
    HAVING mastery < 80
    ORDER BY mastery ASC, ls.position ASC
    LIMIT 5
  `).bind(studentId, teacher.school_id).all();

  if (!weakSkills.length) {
    return err('برای این دانش‌آموز مهارت ضعیفی برای ساخت تکلیف هوشمند پیدا نشد', 400);
  }

  const skillIds = weakSkills.map(s => s.id);

  const placeholders = skillIds.map(() => '?').join(',');

  const { results: questions } = await env.DB.prepare(`
    SELECT DISTINCT
      q.id,
      q.question_type,
      q.question_text,
      q.answer,
      q.options
    FROM question_bank q
    JOIN question_skills qs ON qs.question_id = q.id
    WHERE qs.skill_id IN (${placeholders})
    ORDER BY RANDOM()
    LIMIT ?
  `).bind(...skillIds, limit).all();

  if (!questions.length) {
    return err('برای مهارت‌های ضعیف این دانش‌آموز سؤال مناسبی پیدا نشد', 400);
  }

  const assignment = await env.DB.prepare(`
    INSERT INTO assignments
      (teacher_id, school_id, class_id, title, due_date)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    teacher.id,
    teacher.school_id,
    classId,
    title,
    dueDate
  ).run();

  const assignmentId = assignment.meta?.last_row_id;

  if (!assignmentId) {
    return err('ساخت تکلیف انجام نشد', 500);
  }

  for (let i = 0; i < questions.length; i++) {
    await env.DB.prepare(`
      INSERT INTO assignment_questions
        (assignment_id, question_id, position)
      VALUES (?, ?, ?)
    `).bind(
      assignmentId,
      questions[i].id,
      i
    ).run();
  }

  return json({
    ok: true,
    assignmentId,
    studentId,
    weakSkills: weakSkills.map(s => ({
      id: s.id,
      name: s.name,
      subject: s.subject,
      mastery: Number(s.mastery || 0)
    })),
    questionCount: questions.length
  });
}
