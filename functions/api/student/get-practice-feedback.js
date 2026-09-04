import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;

  if (!student || student.role !== 'student') {
    return err('forbidden', 403);
  }

  const url = new URL(request.url);
  const submissionId = Number(url.searchParams.get('submission_id'));

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return err('submission_id is required', 400);
  }

  const submission = await env.DB.prepare(
    `SELECT
       id,
       student_id,
       score,
       status,
       submitted_at
     FROM submissions
     WHERE id = ?
       AND student_id = ?`
  ).bind(submissionId, student.id).first();

  if (!submission) {
    return err('practice submission not found', 404);
  }

  const { results: skills } = await env.DB.prepare(
    `SELECT
       ssr.skill_id AS id,
       ls.subject,
       ls.grade,
       ls.code,
       ls.name,
       ls.description,
       ssr.correct_count,
       ssr.answer_count,
       ssr.mastery
     FROM student_skill_results ssr
     JOIN learning_skills ls
       ON ls.id = ssr.skill_id
     WHERE ssr.submission_id = ?
       AND ssr.student_id = ?
     ORDER BY
       ssr.mastery ASC,
       ssr.answer_count DESC,
       ls.position ASC,
       ls.id ASC`
  ).bind(submissionId, student.id).all();

  const normalizedSkills = skills.map((skill) => {
    const mastery = Number(skill.mastery || 0);
    const correctCount = Number(skill.correct_count || 0);
    const answerCount = Number(skill.answer_count || 0);

    let status = 'mastered';
    let message = 'عالی! این مهارت را خوب بلدی.';

    if (mastery < 60) {
      status = 'needs_support';
      message = 'این مهارت نیاز به تمرین بیشتری دارد.';
    } else if (mastery < 80) {
      status = 'developing';
      message = 'در مسیر یادگیری هستی؛ چند تمرین دیگر کمک می‌کند.';
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
      message,
    };
  });

  const weakSkills = normalizedSkills.filter(
    (skill) => skill.mastery < 80
  );

  const strongSkills = normalizedSkills.filter(
    (skill) => skill.mastery >= 80
  );

  let recommendation = 'تمرین خوبی بود!';

  if (weakSkills.length) {
    recommendation =
      `پیشنهاد می‌کنیم روی «${weakSkills[0].name}» تمرکز کنی و چند تمرین دیگر انجام بدهی.`;
  } else if (strongSkills.length) {
    recommendation =
      'آفرین! مهارت‌های این تمرین در وضعیت خوبی هستند.';
  }

  return json({
    ok: true,
    submission: {
      id: Number(submission.id),
      score:
        submission.score == null
          ? null
          : Number(submission.score),
      status: submission.status,
      submittedAt: submission.submitted_at,
    },
    skills: normalizedSkills,
    weakSkills,
    strongSkills,
    recommendation,
  });
}
