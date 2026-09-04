import { json, err } from '../_lib/http.js';

const MAX_CODE_LEN = 128;

// این مسیر عمومی است (بدون سشن) — والدین با parent_code وارد می‌شوند، نه ورود با رمز.
// الگوی احراز هویت دقیقاً مطابق submit-feedback.js / get-garden-diary.js است.
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const code = String(body?.code || '').trim();
    const studentId = Number(body?.student_id || 0);

    if (!code) {
      return err('code is required', 400);
    }

    if (code.length > MAX_CODE_LEN) {
      return err('invalid code', 400);
    }

    if (!studentId) {
      return err('student_id required', 400);
    }

    // دانش‌آموزی که parent_code‌اش با کد ارسالی یکی است
    const student = await env.DB.prepare(`
      SELECT
        id,
        full_name,
        school_id,
        growth_points,
        avatar,
        class_id,
        parent_code
      FROM users
      WHERE id = ?
        AND role = 'student'
        AND is_active = 1
      LIMIT 1
    `).bind(studentId).first();

    if (!student) {
      return err('student not found', 404);
    }

    // مالکیت واقعی: کد ارسالی باید دقیقاً با parent_code همین دانش‌آموز یکی باشد
    if (!student.parent_code || student.parent_code !== code) {
      return err('access denied', 403);
    }

    const [scores, skills, badges, rewards] = await Promise.all([
      env.DB.prepare(`
        SELECT
          id,
          score,
          status,
          submitted_at
        FROM submissions
        WHERE student_id = ?
        ORDER BY submitted_at DESC
        LIMIT 20
      `).bind(studentId).all(),

      env.DB.prepare(`
        SELECT
          ls.id,
          ls.name,
          ls.subject,
          ls.code,
          COALESCE(SUM(ssr.correct_count), 0) AS correct_count,
          COALESCE(SUM(ssr.answer_count), 0) AS answer_count,
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
        ORDER BY mastery ASC, ls.position ASC
      `).bind(
        studentId,
        student.school_id
      ).all(),

      env.DB.prepare(`
        SELECT
          b.code,
          b.name,
          b.icon,
          b.description,
          ub.earned_at
        FROM user_badges ub
        JOIN badges b ON b.code = ub.badge_code
        WHERE ub.user_id = ?
        ORDER BY ub.earned_at DESC
      `).bind(studentId).all(),

      env.DB.prepare(`
        SELECT
          reward_date,
          reward_type,
          reward_value
        FROM daily_rewards
        WHERE user_id = ?
        ORDER BY reward_date DESC
        LIMIT 10
      `).bind(studentId).all()
    ]);

    const scoreRows = scores.results || [];

    const scored = scoreRows.filter(
      s => s.score !== null && s.score !== undefined
    );

    const averageScore = scored.length
      ? Math.round(
          scored.reduce(
            (total, s) => total + Number(s.score || 0),
            0
          ) / scored.length
        )
      : 0;

    const skillRows = (skills.results || []).map(s => ({
      id: s.id,
      name: s.name,
      subject: s.subject,
      code: s.code,
      mastery: Math.round(Number(s.mastery || 0)),
      correctCount: Number(s.correct_count || 0),
      answerCount: Number(s.answer_count || 0),
      status:
        Number(s.answer_count || 0) === 0
          ? 'not_started'
          : Number(s.mastery || 0) < 60
            ? 'needs_support'
            : Number(s.mastery || 0) < 80
              ? 'developing'
              : 'mastered'
    }));

    const started = skillRows.filter(
      s => s.answerCount > 0
    );

    const overallMastery = started.length
      ? Math.round(
          started.reduce(
            (total, s) => total + s.mastery,
            0
          ) / started.length
        )
      : 0;

    return json({
      ok: true,

      student: {
        id: student.id,
        fullName: student.full_name,
        avatar: student.avatar,
        growthPoints: Number(student.growth_points || 0)
      },

      summary: {
        submissions: scoreRows.length,
        scoredSubmissions: scored.length,
        averageScore,
        overallMastery,
        strongSkills: skillRows.filter(
          s => s.status === 'mastered'
        ).length,
        needsSupport: skillRows.filter(
          s => s.status === 'needs_support'
        ).length,
        developing: skillRows.filter(
          s => s.status === 'developing'
        ).length,
        badges: (badges.results || []).length
      },

      scores: scoreRows,
      skills: skillRows,
      badges: badges.results || [],
      rewards: rewards.results || []
    });
  } catch (e) {
    console.error('parent get-learning-report error:', e);
    return err('خطا در دریافت گزارش یادگیری', 500);
  }
}
