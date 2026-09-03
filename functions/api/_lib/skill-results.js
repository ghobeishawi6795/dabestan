export async function recordSkillResults(env, submissionId) {
  const submission = await env.DB.prepare(
    `SELECT student_id FROM submissions WHERE id = ?`
  ).bind(submissionId).first();

  if (!submission) return;

  const { results } = await env.DB.prepare(
    `SELECT sa.is_correct, qs.skill_id
     FROM submission_answers sa
     JOIN question_skills qs ON qs.question_id = sa.question_id
     JOIN learning_skills ls ON ls.id = qs.skill_id AND ls.is_active = 1
     WHERE sa.submission_id = ? AND sa.is_correct IS NOT NULL`
  ).bind(submissionId).all();

  await env.DB.prepare(
    `DELETE FROM student_skill_results WHERE submission_id = ?`
  ).bind(submissionId).run();

  const stats = new Map();

  for (const row of results) {
    if (!stats.has(row.skill_id)) {
      stats.set(row.skill_id, { correct: 0, total: 0 });
    }

    const s = stats.get(row.skill_id);
    s.total++;
    if (row.is_correct === 1) s.correct++;
  }

  const inserts = [...stats.entries()].map(([skillId, s]) =>
    env.DB.prepare(
      `INSERT INTO student_skill_results
       (submission_id, student_id, skill_id, correct_count, answer_count, mastery)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      submissionId,
      submission.student_id,
      skillId,
      s.correct,
      s.total,
      Math.round((s.correct / s.total) * 100)
    )
  );

  if (inserts.length) await env.DB.batch(inserts);
}
