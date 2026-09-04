import { json, err } from '../_lib/http.js';

async function getStudent(request, env) {
  const data = await env.DB.prepare(`
    SELECT id, school_id
    FROM users
    WHERE id = ? AND role = 'student'
    LIMIT 1
  `).bind(data.user.id).first();

  return data;
}

async function getGoal(env, goalId, studentId) {
  return env.DB.prepare(`
    SELECT
      g.id,
      g.skill_id,
      g.title,
      g.description,
      g.target_mastery,
      g.due_date,
      g.created_at,
      g.updated_at,
      ls.name AS skill_name,
      COALESCE(
        ROUND(
          SUM(ssr.correct_count) * 100.0 /
          NULLIF(SUM(ssr.answer_count), 0)
        ),
        0
      ) AS current_mastery
    FROM student_goals g
    JOIN learning_skills ls
      ON ls.id = g.skill_id
    LEFT JOIN student_skill_results ssr
      ON ssr.student_id = g.student_id
     AND ssr.skill_id = g.skill_id
    WHERE g.id = ?
      AND g.student_id = ?
    GROUP BY
      g.id,
      g.skill_id,
      g.title,
      g.description,
      g.target_mastery,
      g.due_date,
      g.created_at,
      g.updated_at,
      ls.name
    LIMIT 1
  `).bind(goalId, studentId).first();
}

function normalizeGoal(goal) {
  if (!goal) return null;

  const current = Number(goal.current_mastery) || 0;
  const target = Number(goal.target_mastery) || 0;

  return {
    ...goal,
    current_mastery: current,
    target_mastery: target,
    progress: target > 0
      ? Math.min(100, Math.round((current / target) * 100))
      : 0,
    completed: current >= target
  };
}

export async function onRequestGet({ request, env, data }) {
  const student = await getStudent(request, env);

  if (!student) {
    return err('دانش‌آموز پیدا نشد', 404);
  }

  const result = await env.DB.prepare(`
    SELECT
      g.id,
      g.skill_id,
      g.title,
      g.description,
      g.target_mastery,
      g.due_date,
      g.created_at,
      g.updated_at,
      ls.name AS skill_name,
      COALESCE(
        ROUND(
          SUM(ssr.correct_count) * 100.0 /
          NULLIF(SUM(ssr.answer_count), 0)
        ),
        0
      ) AS current_mastery
    FROM student_goals g
    JOIN learning_skills ls
      ON ls.id = g.skill_id
    LEFT JOIN student_skill_results ssr
      ON ssr.student_id = g.student_id
     AND ssr.skill_id = g.skill_id
    WHERE g.student_id = ?
    GROUP BY
      g.id,
      g.skill_id,
      g.title,
      g.description,
      g.target_mastery,
      g.due_date,
      g.created_at,
      g.updated_at,
      ls.name
    ORDER BY
      CASE
        WHEN current_mastery >= target_mastery THEN 1
        ELSE 0
      END,
      g.due_date IS NULL,
      g.due_date,
      g.created_at DESC
  `).bind(student.id).all();

  return json({
    ok: true,
    goals: (result.results || []).map(normalizeGoal)
  });
}

export async function onRequestPost({ request, env, data }) {
  const student = await getStudent(request, env);

  if (!student) {
    return err('دانش‌آموز پیدا نشد', 404);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return err('اطلاعات نامعتبر است', 400);
  }

  const skillId = Number(body.skill_id);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim() || null;
  const targetMastery = Number(body.target_mastery ?? 80);
  const dueDate = body.due_date ? String(body.due_date) : null;

  if (!skillId || !title) {
    return err('مهارت و عنوان هدف الزامی است', 400);
  }

  if (
    !Number.isFinite(targetMastery) ||
    targetMastery < 1 ||
    targetMastery > 100
  ) {
    return err('درصد هدف باید بین ۱ تا ۱۰۰ باشد', 400);
  }

  const skill = await env.DB.prepare(`
    SELECT id, name
    FROM learning_skills
    WHERE id = ?
      AND school_id = ?
      AND is_active = 1
    LIMIT 1
  `).bind(skillId, student.school_id).first();

  if (!skill) {
    return err('مهارت انتخاب‌شده معتبر نیست', 400);
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM student_goals
    WHERE student_id = ?
      AND skill_id = ?
      AND target_mastery = ?
    LIMIT 1
  `).bind(student.id, skillId, targetMastery).first();

  if (existing) {
    return err('برای این مهارت با این هدف، قبلاً هدف ساخته‌ای', 409);
  }

  const result = await env.DB.prepare(`
    INSERT INTO student_goals (
      student_id,
      school_id,
      skill_id,
      title,
      description,
      target_mastery,
      due_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    student.id,
    student.school_id,
    skillId,
    title,
    description,
    targetMastery,
    dueDate
  ).run();

  const goal = await getGoal(env, result.meta.last_row_id, student.id);

  return json({
    ok: true,
    goal: normalizeGoal(goal)
  }, 201);
}

export async function onRequestPatch({ request, env, data }) {
  const student = await getStudent(request, env);

  if (!student) {
    return err('دانش‌آموز پیدا نشد', 404);
  }

  const body = await request.json().catch(() => null);

  if (!body || !body.id) {
    return err('شناسه هدف الزامی است', 400);
  }

  const goalId = Number(body.id);

  const existing = await env.DB.prepare(`
    SELECT id
    FROM student_goals
    WHERE id = ?
      AND student_id = ?
    LIMIT 1
  `).bind(goalId, student.id).first();

  if (!existing) {
    return err('هدف پیدا نشد', 404);
  }

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim() || null;
  const targetMastery = Number(body.target_mastery);
  const dueDate = body.due_date ? String(body.due_date) : null;

  if (!title) {
    return err('عنوان هدف الزامی است', 400);
  }

  if (
    !Number.isFinite(targetMastery) ||
    targetMastery < 1 ||
    targetMastery > 100
  ) {
    return err('درصد هدف باید بین ۱ تا ۱۰۰ باشد', 400);
  }

  await env.DB.prepare(`
    UPDATE student_goals
    SET
      title = ?,
      description = ?,
      target_mastery = ?,
      due_date = ?,
      updated_at = datetime('now')
    WHERE id = ?
      AND student_id = ?
  `).bind(
    title,
    description,
    targetMastery,
    dueDate,
    goalId,
    student.id
  ).run();

  const goal = await getGoal(env, goalId, student.id);

  return json({
    ok: true,
    goal: normalizeGoal(goal)
  });
}

export async function onRequestDelete({ request, env, data }) {
  const student = await getStudent(request, env);

  if (!student) {
    return err('دانش‌آموز پیدا نشد', 404);
  }

  const url = new URL(request.url);
  const goalId = Number(url.searchParams.get('id'));

  if (!goalId) {
    return err('شناسه هدف الزامی است', 400);
  }

  const result = await env.DB.prepare(`
    DELETE FROM student_goals
    WHERE id = ?
      AND student_id = ?
  `).bind(goalId, student.id).run();

  if (!result.meta.changes) {
    return err('هدف پیدا نشد', 404);
  }

  return json({
    ok: true
  });
}
