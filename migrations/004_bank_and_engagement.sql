-- Migration 004: question bank enhancements + profile photos + in-app notifications + parent<->teacher chat.

-- ── بانک سؤال: تگ، موردعلاقه، سطح سختی ────────────────────────────────────
ALTER TABLE question_bank ADD COLUMN tags TEXT;                          -- comma-separated, e.g. "جمع,اعداد دورقمی"
ALTER TABLE question_bank ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE question_bank ADD COLUMN difficulty TEXT;                    -- 'easy' | 'medium' | 'hard'

-- ── عکس پروفایل واقعی (base64، بدون R2 — هم‌راستا با بقیهٔ مدیا) ─────────
ALTER TABLE users ADD COLUMN avatar_photo TEXT;                          -- data URL, size-capped at the API layer

-- ── اعلان‌های داخل‌اپی (تکلیف جدید، نمره آماده شد، پیام جدید) ────────────
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,             -- 'new_assignment' | 'grade_ready' | 'parent_message'
  title TEXT NOT NULL,
  body TEXT,
  related_id INTEGER,             -- assignment_id / submission_id / parent_messages.id depending on type
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ── گفتگوی کوتاه والد↔معلم — با همون parent_code (والدین لاگین ندارن) ───
CREATE TABLE parent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  sender TEXT NOT NULL CHECK (sender IN ('parent','teacher')),
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_parent_messages_student ON parent_messages(student_id);
CREATE INDEX idx_parent_messages_teacher ON parent_messages(teacher_id, is_read);
