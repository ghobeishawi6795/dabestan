import { json, err } from '../_lib/http.js';

function getSkillStatus(mastery, answerCount) {
  if (!answerCount) return 'not_started';
  if (mastery < 60) return 'needs_support';
  if (mastery < 80) return 'developing';
  return 'mastered';
}

export async function onRequestGet({ env, data }) {
  const student = data.user;

  if (student.role !== 'student') {
    return err('forbidden', 403);
  }

  const { results: history } = await env.DB.prepare(
    `SELECT s.score, s.reviewed_at, a.title
     FROM submissions s
     JOIN assignments a ON a.id = s.assignment_id
     WHERE s.student_id = ?
       AND s.status = 'reviewed'
       AND s.score IS NOT NULL
     ORDER BY s.reviewed_at ASC
     LIMIT 60`
  ).bind(student.id).all();

  const { results: skills } = await env.DB.prepare(
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
           COALESCE(SUM(ssr.correct_count), 0) * 100.0 /
           SUM(ssr.answer_count)
         )
       END AS mastery
     FROM learning_skills ls
     LEFT JOIN student_skill_results ssr
       ON ssr.skill_id = ls.id
      AND ssr.student_id = ?
     WHERE ls.school_id = ?
       AND ls.is_active = 1
     GROUP BY
       ls.id,
       ls.subject,
       ls.grade,
       ls.code,
       ls.name,
       ls.description
     ORDER BY
       mastery DESC,
       ls.position ASC,
       ls.id ASC`
  ).bind(student.id, student.school_id).all();

  const normalizedSkills = skills.map((skill) => {
    const mastery = Number(skill.mastery || 0);
    const answerCount = Number(skill.answer_count || 0);
    const correctCount = Number(skill.correct_count || 0);

    return {
      id: skill.id,
      subject: skill.subject,
      grade: skill.grade,
      code: skill.code,
      name: skill.name,
      description: skill.description,
      correctCount,
      answerCount,
      mastery,
      status: getSkillStatus(mastery, answerCount),
    };
  });

  const summary = {
    totalSkills: normalizedSkills.length,
    startedSkills: normalizedSkills.filter(
      (s) => s.status !== 'not_started'
    ).length,
    masteredSkills: normalizedSkills.filter(
      (s) => s.status === 'mastered'
    ).length,
    developingSkills: normalizedSkills.filter(
      (s) => s.status === 'developing'
    ).length,
    needsSupportSkills: normalizedSkills.filter(
      (s) => s.status === 'needs_support'
    ).length,
  };

  return json({
    history: history.map((r) => ({
      score: r.score,
      date: r.reviewed_at,
      title: r.title,
    })),
    skills: normalizedSkills,
    summary,
  });
}
