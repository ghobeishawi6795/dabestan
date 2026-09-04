import { json, err } from '../_lib/http.js';

function getAction(status, mastery) {
  if (status === 'needs_support') {
    return {
      type: 'practice',
      label: 'تمرین هدفمند',
      text: `مهارت نیاز به تقویت دارد (${mastery}٪).`
    };
  }

  if (status === 'developing') {
    return {
      type: 'review',
      label: 'مرور و تمرین',
      text: `یادگیری در حال شکل‌گیری است (${mastery}٪).`
    };
  }

  return {
    type: 'monitor',
    label: 'پایش',
    text: `وضعیت یادگیری مناسب است (${mastery}٪).`
  };
}

function getStatus(mastery) {
  if (mastery < 60) return 'needs_support';
  if (mastery < 80) return 'developing';
  return 'mastered';
}

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

  const classRow = await env.DB.prepare(`
    SELECT id, name, grade
    FROM classes
    WHERE id = ?
      AND teacher_id = ?
      AND school_id = ?
    LIMIT 1
  `).bind(
    classId,
    teacher.id,
    teacher.school_id
  ).first();

  if (!classRow) {
    return err('class not found', 404);
  }

  /*
   * دانش‌آموزان نیازمند توجه:
   * فقط نمره‌های واقعیِ نمره‌گذاری‌شده از تکالیف همین معلم.
   */
  const { results: studentRows } = await env.DB.prepare(`
    SELECT
      u.id,
      u.name,
      u.username,
      COUNT(s.id) AS submission_count,
      ROUND(AVG(s.score), 1) AS average_score
    FROM users u
    INNER JOIN submissions s
      ON s.student_id = u.id
    INNER JOIN assignments a
      ON a.id = s.assignment_id
    WHERE u.school_id = ?
      AND u.class_id = ?
      AND u.role = 'student'
      AND u.is_active = 1
      AND a.teacher_id = ?
      AND a.school_id = ?
      AND a.class_id = ?
      AND s.status = 'reviewed'
      AND s.score IS NOT NULL
    GROUP BY
      u.id,
      u.name,
      u.username
    ORDER BY average_score ASC, u.name ASC, u.id ASC
  `).bind(
    teacher.school_id,
    classId,
    teacher.id,
    teacher.school_id,
    classId
  ).all();

  const students = studentRows.map((row) => {
    const average = Number(row.average_score || 0);
    const mastery = Math.round(average);
    const status = getStatus(mastery);

    return {
      id: Number(row.id),
      name: row.name,
      username: row.username,
      submissionCount: Number(row.submission_count || 0),
      averageScore: Number(row.average_score),
      mastery,
      status,
      action: getAction(status, mastery)
    };
  });

  const needsAttention = students.filter(
    (student) => student.status === 'needs_support'
  );

  const developingStudents = students.filter(
    (student) => student.status === 'developing'
  );

  /*
   * مهارت‌های ضعیف کلاس:
   * فقط student_skill_results مربوط به submissionهای بررسی‌شده
   * از assignmentهای همین معلم.
   */
  const { results: skillRows } = await env.DB.prepare(`
    SELECT
      ls.id,
      ls.name,
      ls.subject,
      ls.code,
      COALESCE(SUM(ssr.correct_count), 0) AS correct_count,
      COALESCE(SUM(ssr.answer_count), 0) AS answer_count
    FROM learning_skills ls
    INNER JOIN student_skill_results ssr
      ON ssr.skill_id = ls.id
    INNER JOIN submissions s
      ON s.id = ssr.submission_id
    INNER JOIN assignments a
      ON a.id = s.assignment_id
    INNER JOIN users u
      ON u.id = ssr.student_id
    WHERE ls.school_id = ?
      AND ls.is_active = 1
      AND a.teacher_id = ?
      AND a.school_id = ?
      AND a.class_id = ?
      AND s.status = 'reviewed'
      AND u.school_id = ?
      AND u.class_id = ?
      AND u.role = 'student'
      AND u.is_active = 1
    GROUP BY
      ls.id,
      ls.name,
      ls.subject,
      ls.code
    HAVING COALESCE(SUM(ssr.answer_count), 0) > 0
    ORDER BY
      (
        COALESCE(SUM(ssr.correct_count), 0) * 100.0 /
        COALESCE(SUM(ssr.answer_count), 0)
      ) ASC,
      ls.id ASC
    LIMIT 5
  `).bind(
    teacher.school_id,
    teacher.id,
    teacher.school_id,
    classId,
    teacher.school_id,
    classId
  ).all();

  const skills = skillRows.map((row) => {
    const correct = Number(row.correct_count || 0);
    const answers = Number(row.answer_count || 0);

    const mastery = answers > 0
      ? Math.round(correct * 100 / answers)
      : 0;

    const status = getStatus(mastery);

    return {
      id: Number(row.id),
      name: row.name,
      subject: row.subject,
      code: row.code,
      correctCount: correct,
      answerCount: answers,
      mastery,
      status,
      action: getAction(status, mastery)
    };
  });

  const weakSkills = skills.filter(
    (skill) => skill.status === 'needs_support'
  );

  return json({
    ok: true,

    class: {
      id: Number(classRow.id),
      name: classRow.name,
      grade: classRow.grade
    },

    summary: {
      studentsWithActivity: students.length,
      needsAttention: needsAttention.length,
      developingStudents: developingStudents.length,
      weakSkills: weakSkills.length
    },

    students: needsAttention.slice(0, 8),

    developingStudents: developingStudents.slice(0, 5),

    skills,

    recommendations: {
      studentAction:
        needsAttention.length > 0
          ? 'برای دانش‌آموزان نیازمند توجه، تمرین هدفمند یا بررسی عملکرد اخیر پیشنهاد می‌شود.'
          : developingStudents.length > 0
            ? 'چند دانش‌آموز در مرحله یادگیری هستند؛ مرور و تمرین بیشتر پیشنهاد می‌شود.'
            : 'در حال حاضر دانش‌آموزی با نیاز فوری به حمایت دیده نشد.',

      skillAction:
        weakSkills.length > 0
          ? 'روی مهارت‌های ضعیف‌تر کلاس تمرین هدفمند طراحی کنید.'
          : 'مهارت ضعیف با داده کافی برای اقدام فوری مشاهده نشد.'
    }
  });
}
