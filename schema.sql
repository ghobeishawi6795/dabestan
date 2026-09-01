-- ========================================
-- جدول مدارس (Schools)
-- ========================================
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  teacher_id INTEGER NOT NULL REFERENCES users(id),
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
-- ارسال‌ها (Submissions)
-- یک ردیف برای هر دانش‌آموز برای هر تکلیف
-- ========================================
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','reviewed')),
  score REAL,
  submitted_at TEXT,
  reviewed_at TEXT,
  UNIQUE (assignment_id, student_id)
);

-- ========================================
-- ایندکس‌ها برای پرفرمنس بهتر
-- ========================================
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_school ON question_bank(school_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_teacher ON question_bank(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
