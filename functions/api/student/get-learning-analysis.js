import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;

  if (!student || student.role !== 'student') {
    return err('forbidden', 403);
  }

  const [submissions, skills] = await Promise.all([
    env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
         AVG(score) AS average_score,
         MAX(score) AS best_score,
         MIN(score) AS lowest_score
       FROM submissions
       WHERE student_id = ?`
    ).bind(student.id).first(),

    env.DB.prepare(
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
       ORDER BY mastery ASC, ls.position ASC, ls.id ASC`
    ).bind(student.id, student.school_id).all(),
  ]);

  const normalizedSkills = skills.results.map((skill) => {
    const mastery = Number(skill.mastery || 0);
    const answerCount = Number(skill.answer_count || 0);
    const correctCount = Number(skill.correct_count || 0);

    let status = 'not_started';

    if (answerCount > 0) {
      if (mastery < 60) status = 'needs_support';
      else if (mastery < 80) status = 'developing';
      else status = 'mastered';
    }

    return {
      id: Number(skill.id),
      subject: skill.subject,
      grade: skill.grade,
      code: skill.code,
      name: skill.name,
      description: skill.description,
      correctCount,
      answerCount,
      mastery,
      status,
    };
  });

  const startedSkills = normalizedSkills.filter(
    (skill) => skill.answerCount > 0
  );

  const weakSkills = startedSkills.filter(
    (skill) => skill.mastery < 60
  );

  const developingSkills = startedSkills.filter(
    (skill) => skill.mastery >= 60 && skill.mastery < 80
  );

  const masteredSkills = startedSkills.filter(
    (skill) => skill.mastery >= 80
  );

  let overallMastery = 0;

  if (startedSkills.length) {
    overallMastery = Math.round(
      startedSkills.reduce(
        (sum, skill) => sum + skill.mastery,
        0
      ) / startedSkills.length
    );
  }

  let level = 'شروع نشده';

  if (overallMastery >= 80) {
    level = 'عالی';
  } else if (overallMastery >= 60) {
    level = 'در حال پیشرفت';
  } else if (overallMastery > 0) {
    level = 'نیازمند تمرین';
  }

  return json({
    ok: true,

    summary: {
      totalSubmissions: Number(submissions?.total || 0),
      scoredSubmissions: Number(submissions?.scored || 0),
      averageScore:
        submissions?.average_score == null
          ? null
          : Math.round(Number(submissions.average_score)),
      bestScore:
        submissions?.best_score == null
          ? null
          : Number(submissions.best_score),
      lowestScore:
        submissions?.lowest_score == null
          ? null
          : Number(submissions.lowest_score),

      totalSkills: normalizedSkills.length,
      startedSkills: startedSkills.length,
      weakSkills: weakSkills.length,
      developingSkills: developingSkills.length,
      masteredSkills: masteredSkills.length,

      overallMastery,
      level,
    },

    weakSkills,
    developingSkills,
    masteredSkills,
    skills: normalizedSkills,
  });
}
