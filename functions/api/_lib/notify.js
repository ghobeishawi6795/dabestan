// سیستم اعلان‌های داخل‌اپی
// اعلان‌ها داخل جدول notifications ذخیره می‌شوند.

export async function notify(env, userId, type, title, body = null, relatedId = null) {
  if (!userId) return;

  await env.DB.prepare(`
    INSERT INTO notifications
      (user_id, type, title, body, related_id)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    Number(userId),
    String(type),
    String(title),
    body == null ? null : String(body),
    relatedId == null ? null : Number(relatedId)
  ).run();
}

// ارسال یک اعلان به همه دانش‌آموزان فعال یک کلاس
export async function notifyClass(env, classId, type, title, body = null, relatedId = null) {
  if (!classId) return;

  const { results: students } = await env.DB.prepare(`
    SELECT id
    FROM users
    WHERE class_id = ?
      AND role = 'student'
      AND is_active = 1
  `).bind(Number(classId)).all();

  if (!students?.length) return;

  const statements = students.map((student) =>
    env.DB.prepare(`
      INSERT INTO notifications
        (user_id, type, title, body, related_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      Number(student.id),
      String(type),
      String(title),
      body == null ? null : String(body),
      relatedId == null ? null : Number(relatedId)
    )
  );

  await env.DB.batch(statements);
}

// یادآوری تکالیفی که موعدشان امروز یا فرداست.
// با due_soon_reminders_sent جلوی اعلان تکراری گرفته می‌شود.
export async function generateDueSoonReminders(env, student) {
  if (!student?.id || !student?.class_id) return;

  const { results } = await env.DB.prepare(`
    SELECT
      a.id,
      a.title
    FROM assignments a
    WHERE a.class_id = ?
      AND a.due_at IS NOT NULL
      AND date(a.due_at) BETWEEN date('now') AND date('now', '+1 day')
      AND NOT EXISTS (
        SELECT 1
        FROM submissions s
        WHERE s.assignment_id = a.id
          AND s.student_id = ?
          AND s.status IN ('submitted', 'reviewed')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM due_soon_reminders_sent d
        WHERE d.assignment_id = a.id
          AND d.student_id = ?
      )
    ORDER BY a.due_at ASC, a.id ASC
  `).bind(
    Number(student.class_id),
    Number(student.id),
    Number(student.id)
  ).all();

  for (const assignment of results || []) {
    await notify(
      env,
      student.id,
      'due_soon',
      'موعد تکلیف نزدیکه ⏰',
      assignment.title,
      assignment.id
    );

    await env.DB.prepare(`
      INSERT INTO due_soon_reminders_sent
        (assignment_id, student_id)
      VALUES (?, ?)
    `).bind(
      Number(assignment.id),
      Number(student.id)
    ).run();
  }
}
