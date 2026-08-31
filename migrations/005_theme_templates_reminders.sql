-- Migration 005: school theme color + assignment templates + due-soon reminder dedupe.

-- ── رنگ اختصاصی مدرسه (برای اعمال روی CSS variableهای اصلی) ──────────────
ALTER TABLE schools ADD COLUMN theme_color TEXT; -- hex, e.g. '#3F7A52'؛ خالی یعنی رنگ پیش‌فرض باغچه

-- ── تکلیف الگو: یک ست ذخیره‌شده از سؤالای بانک که با یک کلیک دوباره ارسال می‌شه ──
CREATE TABLE assignment_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  question_ids TEXT NOT NULL,  -- JSON array of question_bank.id، به همون ترتیب ارسال
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_assignment_templates_teacher ON assignment_templates(teacher_id);

-- ── جلوگیری از یادآوریِ تکراری «نزدیک موعد» برای یک تکلیف/دانش‌آموز ──────
-- یادآورها به‌صورت lazy (هنگام باز کردن اپ توسط دانش‌آموز) تولید می‌شن، نه با cron جدا؛
-- این جدول همون نقش dedupe رو بازی می‌کنه تا دوبار برای یک تکلیف اعلان نره.
CREATE TABLE due_soon_reminders_sent (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, student_id)
);
