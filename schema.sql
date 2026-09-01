PRAGMA foreign_keys = ON;

-- Homework App — D1 schema (v2, synced from live database)
-- این فایل دقیقاً منطبق با ساختار واقعی دیتابیس زنده است.
-- No R2: audio/image submissions are stored as base64 TEXT, size-limited at the API layer.

-- ========================================
-- جدول مدارس (Schools)
-- ========================================
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  skip_cards_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========================================
-- نشان‌ها (Badges) — تعریف ثابت
-- ========================================
CREATE TABLE IF NOT EXISTS badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL
);

-- ========================================
-- جدول کاربران (Users)
-- نقش‌ها: admin | teacher | student
-- والدین با parent_code به student وصل می‌شن (نه لاگین جدا)
-- ========================================
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
  growth_points INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_super INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, username)
);

-- ========================================
-- جدول کلاس‌ها (Classes)
-- ========================================
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  grade INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========================================
-- بانک سؤالات (Question Bank)
-- ========================================
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========================================
-- تکالیف (Assignments)
-- ========================================
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

-- ========================================
-- سؤالات هر تکلیف (Assignment Questions)
-- ========================================
CREATE TABLE IF NOT EXISTS assignment_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  position INTEGER NOT NULL DEFAULT 0
);

-- ========================================
-- ارسال‌ها (Submissions)
-- excused = 1 یعنی دانش‌آموز با کارت معافیت رد کرده
-- ========================================
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

-- ========================================
-- پاسخ‌های هر ارسال (Submission Answers)
-- ========================================
CREATE TABLE IF NOT EXISTS submission_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  answer_json TEXT NOT NULL,
  is_correct INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========================================
-- نشان‌های کسب‌شده توسط کاربران (User Badges)
-- ========================================
CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_code TEXT NOT NULL REFERENCES badges(code),
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, badge_code)
);

-- ========================================
-- جوایز روزانه (Daily Rewards)
-- ========================================
CREATE TABLE IF NOT EXISTS daily_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reward_date TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, reward_date)
);

-- ========================================
-- درس‌ها (Lessons)
-- ========================================
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

-- ========================================
-- اتصال درس‌ها به تکالیف (Lesson Assignments)
-- ========================================
CREATE TABLE IF NOT EXISTS lesson_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  position INTEGER NOT NULL DEFAULT 0
);

-- ========================================
-- بازخورد والدین (Parent Feedback)
-- ========================================
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

-- ========================================
-- پیام‌های داخلی (Messages)
-- ========================================
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

-- ========================================
-- حیوان خانگی (Pets)
-- هر دانش‌آموز یک حیوان، با accessories به‌صورت JSON
-- ========================================
CREATE TABLE IF NOT EXISTS pets (
  student_id INTEGER PRIMARY KEY REFERENCES users(id),
  species TEXT NOT NULL,
  accessories TEXT NOT NULL DEFAULT '[]',
  last_fed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========================================
-- خریدهای فروشگاه (Shop Purchases)
-- accessory = مالکیت دائم، skip_card = اعتبار مصرفی (used_at)
-- ========================================
CREATE TABLE IF NOT EXISTS shop_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  item_code TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('accessory', 'skip_card')),
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========================================
-- ایندکس‌ها برای پرفرمنس بهتر
-- ========================================
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_school ON question_bank(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment ON assignment_questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_question ON assignment_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_submission ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_question ON submission_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_date ON daily_rewards(user_id, reward_date);
CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_lesson ON lesson_assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_parent_feedback_teacher ON parent_feedback(teacher_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_student ON shop_purchases(student_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_skip_unused ON shop_purchases(student_id, item_type, used_at);

-- ========================================
-- داده‌های اولیه: نشان‌های سیستم
-- ========================================
INSERT OR IGNORE INTO badges (code, name, icon, description) VALUES
  ('mehregan_1405', 'نشان مهرگان', '🍂', 'توی جشنوارهٔ مهر حداقل یک تکلیف فرستادی');
