-- Migration 002: gamification + engagement features (badges, daily lucky box, lesson chapters,
-- parent satisfaction ratings, admin<->teacher messaging).

CREATE TABLE badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO badges (code, name, icon, description) VALUES
  ('first_task', 'اولین قدم', '🌟', 'اولین تکلیفت رو انجام دادی'),
  ('perfect_score', 'دقت طلایی', '🎯', 'یک تکلیف رو ٪۱۰۰ زدی'),
  ('streak_5', 'آتیش‌پا', '🔥', '۵ روز پیاپی فعالیت داشتی'),
  ('ten_tasks', 'ده‌قدمی', '🏆', '۱۰ تکلیف انجام دادی'),
  ('artist', 'هنرمند', '🎨', 'یک تکلیف نقاشی یا رنگ‌آمیزی فرستادی'),
  ('speaker', 'سخنور', '🎤', 'یک تکلیف صوتی فرستادی');

CREATE TABLE user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_code TEXT NOT NULL REFERENCES badges(code),
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, badge_code)
);

-- یک جعبهٔ شانسی در روز برای هر دانش‌آموز
CREATE TABLE daily_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reward_date TEXT NOT NULL, -- 'YYYY-MM-DD'
  reward_type TEXT NOT NULL, -- 'points'
  reward_value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, reward_date)
);

-- فصل‌های درسی: معلم چند تکلیف رو به ترتیب زیر یک فصل قرار می‌ده؛ فصل بعدی وقتی همهٔ تکالیف فصل قبلی
-- حداقل submitted شده باشن باز می‌شه.
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📘',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lesson_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  position INTEGER NOT NULL DEFAULT 0
);

-- رضایت والدین: بعد از این‌که معلم یک تکلیف رو مرور کرد، والد می‌تونه به تعامل معلم امتیاز بده.
CREATE TABLE parent_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  submission_id INTEGER REFERENCES submissions(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (submission_id)
);

-- پیام مدیر <-> معلم (مثلاً دکمهٔ «پیام به معلم» روی هشدارهای مدیر)
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_daily_rewards_user_date ON daily_rewards(user_id, reward_date);
CREATE INDEX idx_lessons_class ON lessons(class_id);
CREATE INDEX idx_lesson_assignments_lesson ON lesson_assignments(lesson_id);
CREATE INDEX idx_parent_feedback_teacher ON parent_feedback(teacher_id);
CREATE INDEX idx_messages_to ON messages(to_user_id);
