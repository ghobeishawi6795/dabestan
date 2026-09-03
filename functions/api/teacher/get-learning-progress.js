import { json, err } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = request.user;

    if (!user || user.role !== "teacher") {
      return err("دسترسی فقط برای معلم است", 403);
    }

    const url = new URL(request.url);
    const studentId = Number(url.searchParams.get("student_id"));

    if (!Number.isInteger(studentId)) {
      return err("student_id الزامی است", 400);
    }

    const teacher = await env.DB.prepare(`
      SELECT id, school_id
      FROM users
      WHERE id = ?
        AND role = 'teacher'
      LIMIT 1
    `).bind(user.id).first();

    if (!teacher) {
      return err("معلم پیدا نشد", 404);
    }

    /*
     * دانش‌آموز باید:
     * 1. واقعاً student باشد
     * 2. در مدرسه همین معلم باشد
     * 3. در کلاسی باشد که متعلق به همین معلم است
     */
    const student = await env.DB.prepare(`
      SELECT
        u.id,
        u.full_name,
        u.class_id,
        c.name AS class_name
      FROM users u
      INNER JOIN classes c
        ON c.id = u.class_id
      WHERE u.id = ?
        AND u.role = 'student'
        AND u.school_id = ?
        AND c.school_id = ?
        AND c.teacher_id = ?
      LIMIT 1
    `).bind(
      studentId,
      teacher.school_id,
      teacher.school_id,
      teacher.id
    ).first();

    if (!student) {
      return err(
        "دانش‌آموز پیدا نشد یا متعلق به کلاس شما نیست",
        404
      );
    }

    /*
     * آخرین پاسخ هر سؤال در هر submission
     * به عنوان پاسخ نهایی در نظر گرفته می‌شود.
     */
    const result = await env.DB.prepare(`
      WITH latest_answers AS (
        SELECT
          sa.id,
          sa.submission_id,
          sa.question_id,
          sa.is_correct,
          ROW_NUMBER() OVER (
            PARTITION BY sa.submission_id, sa.question_id
            ORDER BY sa.id DESC
          ) AS rn
        FROM submission_answers sa
      ),

      skill_answers AS (
        SELECT
          ls.id AS skill_id,
          ls.subject,
          ls.grade,
          ls.code,
          ls.name,
          ls.description,
          qs.weight,
          la.is_correct
        FROM latest_answers la

        INNER JOIN submissions s
          ON s.id = la.submission_id

        INNER JOIN assignments a
          ON a.id = s.assignment_id

        INNER JOIN assignment_questions aq
          ON aq.assignment_id = a.id
          AND aq.question_id = la.question_id

        INNER JOIN question_skills qs
          ON qs.question_id = la.question_id

        INNER JOIN learning_skills ls
          ON ls.id = qs.skill_id

        WHERE la.rn = 1
          AND s.student_id = ?
          AND s.status = 'reviewed'
          AND s.excused = 0
          AND a.school_id = ?
          AND a.teacher_id = ?
          AND ls.school_id = ?
          AND ls.is_active = 1
      )

      SELECT
        skill_id,
        subject,
        grade,
        code,
        name,
        description,

        COUNT(*) AS answer_count,

        SUM(
          CASE
            WHEN is_correct = 1 THEN weight
            ELSE 0
          END
        ) AS correct_weight,

        SUM(weight) AS total_weight,

        CASE
          WHEN SUM(weight) > 0
          THEN ROUND(
            100.0 *
            SUM(
              CASE
                WHEN is_correct = 1 THEN weight
                ELSE 0
              END
            ) / SUM(weight),
            1
          )
          ELSE 0
        END AS mastery_percent

      FROM skill_answers

      GROUP BY
        skill_id,
        subject,
        grade,
        code,
        name,
        description

      ORDER BY
        subject ASC,
        grade ASC,
        mastery_percent ASC,
        name ASC
    `).bind(
      studentId,
      teacher.school_id,
      teacher.id,
      teacher.school_id
    ).all();

    const skills = (result.results || []).map(row => ({
      skill_id: row.skill_id,
      subject: row.subject,
      grade: row.grade,
      code: row.code,
      name: row.name,
      description: row.description,

      answer_count: Number(row.answer_count || 0),

      correct_weight: Number(row.correct_weight || 0),
      total_weight: Number(row.total_weight || 0),

      mastery_percent: Number(row.mastery_percent || 0)
    }));

    const totalAnswers = skills.reduce(
      (sum, skill) => sum + skill.answer_count,
      0
    );

    const totalWeight = skills.reduce(
      (sum, skill) => sum + skill.total_weight,
      0
    );

    const correctWeight = skills.reduce(
      (sum, skill) => sum + skill.correct_weight,
      0
    );

    const overallMastery =
      totalWeight > 0
        ? Math.round(
            (correctWeight / totalWeight) * 1000
          ) / 10
        : 0;

    return json({
      ok: true,

      student: {
        id: student.id,
        full_name: student.full_name,
        class_id: student.class_id,
        class_name: student.class_name
      },

      summary: {
        skill_count: skills.length,
        answer_count: totalAnswers,
        mastery_percent: overallMastery
      },

      skills
    });

  } catch (e) {
    console.error("get-learning-progress error:", e);
    return err("خطا در محاسبه پیشرفت یادگیری", 500);
  }
}
