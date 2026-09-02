PRAGMA foreign_keys = ON;

-- Homework App — D1 schema (v4, fully synced with live database)
-- No R2: audio/image submissions are stored as base64 TEXT, size-limited at the API layer.

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  skip_cards_enabled INTEGER NOT NULL DEFAULT 1,
  theme_color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  class_id INTEGER REFERENCES classes(id),
  parent_code TEXT,
  avatar TEXT,
  avatar_photo TEXT,
  growth_points INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_super INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, username)
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  grade INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  question_type TEXT NOT NULL,
  subject TEXT,
  grade INTEGER,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  custom_html TEXT,
  tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT,
  chapter TEXT,
  topic TEXT,
  explanation TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  custom_html TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (question_id, version)
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  title TEXT NOT NULL,
  description TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignment_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  position INTEGER NOT NULL DEFAULT 0,
  pinned_version INTEGER
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','reviewed')),
  score REAL,
  excused INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  reviewed_at TEXT,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS submission_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  answer_json TEXT NOT NULL,
  is_correct INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_code TEXT NOT NULL REFERENCES badges(code),
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS daily_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reward_date TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, reward_date)
);

CREATE TABLE IF NOT EXISTS lessons (
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

CREATE TABLE IF NOT EXISTS lesson_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS parent_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  submission_id INTEGER REFERENCES submissions(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (submission_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  sender TEXT NOT NULL CHECK (sender IN ('parent','teacher')),
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignment_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  question_ids TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS due_soon_reminders_sent (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS pets (
  student_id INTEGER PRIMARY KEY REFERENCES users(id),
  species TEXT NOT NULL,
  accessories TEXT NOT NULL DEFAULT '[]',
  last_fed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  item_code TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('accessory', 'skip_card')),
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS duels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  challenger_id INTEGER NOT NULL REFERENCES users(id),
  opponent_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','finished','declined')),
  question_count INTEGER NOT NULL DEFAULT 5,
  winner_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS duel_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  position INTEGER NOT NULL,
  operand_a INTEGER NOT NULL,
  operand_b INTEGER NOT NULL,
  operator TEXT NOT NULL,
  answer INTEGER NOT NULL,
  UNIQUE (duel_id, position)
);

CREATE TABLE IF NOT EXISTS duel_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  position INTEGER NOT NULL,
  submitted_answer INTEGER,
  is_correct INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (duel_id, student_id, position)
);

-- ایندکس‌ها
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_school ON question_bank(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment ON assignment_questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_submission ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_date ON daily_rewards(user_id, reward_date);
CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_lesson ON lesson_assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_parent_feedback_teacher ON parent_feedback(teacher_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_parent_messages_student ON parent_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_teacher ON parent_messages(teacher_id, is_read);
CREATE INDEX IF NOT EXISTS idx_assignment_templates_teacher ON assignment_templates(teacher_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_student ON shop_purchases(student_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_skip_unused ON shop_purchases(student_id, item_type, used_at);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON duels(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_duel_answers_duel_student ON duel_answers(duel_id, student_id);

-- داده‌های اولیه: نشان‌ها
INSERT OR IGNORE INTO badges (code, name, icon, description) VALUES
  ('first_task', 'اولین قدم', '🌟', 'اولین تکلیفت رو انجام دادی'),
  ('perfect_score', 'دقت طلایی', '🎯', 'یک تکلیف رو ٪۱۰۰ زدی'),
  ('streak_5', 'آتیش‌پا', '🔥', ' روز پیاپی فعالیت داشتی'),
  ('ten_tasks', 'ده‌قدمی', '🏆', '۰ تکلیف انجام دادی'),
  ('artist', 'هنرمند', '🎨', 'یک تکلیف نقاشی یا رنگ‌آمیزی فرستادی'),
  ('speaker', 'سخنور', '🎤', 'یک تکلیف صوتی فرستادی'),
  ('first_assignment', 'اولین تکلیف را برای دانش‌آموزان ارسال کردی', '🌱', 'اساتید'),
  ('ten_assignments', '۱۰ تکلیف ارسال کردی', '📚', 'معلم پرکار'),
  ('quick_grader', 'تصحیح سریع', '⚡', 'میانگین زمان تصحیح زیر ۲۴ ساعت است'),
  ('creative_bank', 'از ۵ نوع سؤال استفاده کردی', '🎨', 'معلم خلاق'),
  ('popular_teacher', 'میانگین رضایت والدین بالای ۴ از ۵', '💛', 'محبوب والدین'),
  ('lesson_builder', 'اولین فصل درسی را ساختی', '🏗️', 'برنامه‌ریز'),
  ('mehregan_1405', 'نشان مهرگان', '🍂', 'توی جشنوارهٔ مهر حداقل یک تکلیف فرستادی'),
  ('duel_champion', 'قهرمان نبرد', '⚔️', 'سه نبرد ریاضی رو بردی');
