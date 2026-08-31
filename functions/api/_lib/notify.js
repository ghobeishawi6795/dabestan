// اعلان‌های داخل‌اپی — نه پوش واقعی؛ کاربر با باز کردن اپ (زنگولهٔ اعلان‌ها) می‌بینتشون.
export async function notify(env, userId, type, title, body, relatedId) {
  await env.DB.prepare(
    'INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, type, title, body || null, relatedId ?? null).run();
}

// یک نوتیف برای همهٔ دانش‌آموزهای یک کلاس (batch insert)
export async function notifyClass(env, classId, type, title, body, relatedId) {
  const { results: students } = await env.DB.prepare(
    `SELECT id FROM users WHERE class_id = ? AND role = 'student' AND is_active = 1`
  ).bind(classId).all();
  if (!students.length) return;
  const inserts = students.map((s) =>
    env.DB.prepare('INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, ?, ?, ?, ?)')
      .bind(s.id, type, title, body || null, relatedId ?? null)
  );
  await env.DB.batch(inserts);
}

// یادآوری «موعد نزدیکه» — به‌جای cron جدا (که Cloudflare Pages ازش پشتیبانی نمی‌کنه)،
// همین که دانش‌آموز اپ رو باز می‌کنه و اعلان‌هاش رو می‌خونه، این تابع صدا زده می‌شه:
// تکالیف بدون ارسال که موعدشون امروز/فردا رسیده رو پیدا می‌کنه و یک‌بار یادآوری می‌فرسته
// (جدول due_soon_reminders_sent جلوی تکراری‌شدن رو می‌گیره).
export async function generateDueSoonReminders(env, student) {
  if (!student.class_id) return;
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.title FROM assignments a
     WHERE a.class_id = ? AND a.due_at IS NOT NULL
       AND date(a.due_at) BETWEEN date('now') AND date('now', '+1 day')
       AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = ? AND s.status IN ('submitted','reviewed'))
       AND NOT EXISTS (SELECT 1 FROM due_soon_reminders_sent d WHERE d.assignment_id = a.id AND d.student_id = ?)`
  ).bind(student.class_id, student.id, student.id).all();

  for (const a of results) {
    await notify(env, student.id, 'due_soon', 'موعد تکلیف نزدیکه ⏰', a.title, a.id);
    await env.DB.prepare('INSERT INTO due_soon_reminders_sent (assignment_id, student_id) VALUES (?, ?)').bind(a.id, student.id).run();
  }
}
