import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;

  if (!teacher || teacher.role !== 'teacher') {
    return err('forbidden', 403);
  }

  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('class_id'));

  if (!Number.isInteger(classId) || classId <= 0) {
    return err('class_id is required', 400);
  }

  const classRow = await env.DB.prepare(
    `SELECT id, name
     FROM classes
     WHERE id = ? AND school_id = ?`
  ).bind(classId, teacher.school_id).first();

  if (!classRow) {
    return err('class not found', 404);
  }

  const { results } = await env.DB.prepare(
    `SELECT
       ls.id,
       ls.subject,
       ls.grade,
       ls.code,
       ls.name,
       ls.description,
       COALESCE(SUM(ssr.correct_count), 0) AS correct_count,
       COALESCE(SUM(ssr.answer_count), 0) AS answer_count,
       CASE
         WHEN COALESCE(SUM(ssr.answer_count), 0) = 0 THEN 0
         ELSE ROUND(
           SUM(ssr.correct_count) * 100.0 /
           SUM(ssr.answer_count)
         )
       END AS mastery
     FROM learning_skills ls
     JOIN student_skill_results ssr
       ON ssr.skill_id = ls.id
     JOIN users u
       ON u.id = ssr.student_id
     WHERE ls.school_id = ?
       AND ls.is_active = 1
       AND u.school_id = ?
       AND u.class_id = ?
       AND u.role = 'student'
     GROUP BY
       ls.id,
       ls.subject,
       ls.grade,
       ls.code,
       ls.name,
       ls.description
     ORDER BY mastery ASC, ls.position ASC, ls.id ASC`
  ).bind(
    teacher.school_id,
    teacher.school_id,
    classId
  ).all();

  const skills = results.map(skill => {
    const mastery = Number(skill.mastery || 0);

    let status = 'mastered';

    if (mastery < 60) {
      status = 'needs_support';
    } else if (mastery < 80) {
      status = 'developing';
    }

    return {
      id: Number(skill.id),
      subject: skill.subject,
      grade: skill.grade,
      code: skill.code,
      name: skill.name,
      description: skill.description,
      correctCount: Number(skill.correct_count || 0),
      answerCount: Number(skill.answer_count || 0),
      mastery,
      status,
    };
  });

  return json({
    ok: true,
    class: {
      id: Number(classRow.id),
      name: classRow.name,
    },
    summary: {
      skillCount: skills.length,
      needsSupport: skills.filter(
        s => s.status === 'needs_support'
      ).length,
      developing: skills.filter(
        s => s.status === 'developing'
      ).length,
      mastered: skills.filter(
        s => s.status === 'mastered'
      ).length,
    },
    skills,
  });
}
