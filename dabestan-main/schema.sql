-- Homework App — D1 schema (v1, auth + user management core)
-- No R2: audio/image submissions are stored as base64 TEXT, size-limited at the API layer.

PRAGMA foreign_keys = ON;

CREATE TABLE schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- role: 'admin' | 'teacher' | 'student'
-- parents have no login row of their own; they use a read-only parent_code stored on the student row.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  class_id INTEGER REFERENCES classes(id),   -- only meaningful for role='student'
  parent_code TEXT,                          -- only meaningful for role='student'; unique read-only viewer code
  avatar TEXT,                               -- e.g. 'seed_1', 'bird_3' — current growth stage / chosen character
  growth_points INTEGER NOT NULL DEFAULT 0,  -- drives dashboard growth animation
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, username)
);

CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  grade INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- question_type: 'multiple_choice' | 'true_false' | 'matching' | 'ordering' | 'fill_blank'
--              | 'drawing' | 'coloring' | 'audio_record' | 'photo_upload' | 'drag_connect' | 'custom_html'
CREATE TABLE question_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  question_type TEXT NOT NULL,
  subject TEXT,
  grade INTEGER,
  title TEXT NOT NULL,
  -- structured question content as JSON (prompt text, options, correct answer key, media refs).
  -- the answer key inside this JSON must NEVER be sent to students — strip before returning to student/get-*.
  content_json TEXT NOT NULL,
  -- for question_type='custom_html': sanitized/sandboxed HTML fragment, rendered only inside a
  -- sandboxed iframe (sandbox="allow-scripts", no allow-same-origin) — never trusted with session access.
  custom_html TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  title TEXT NOT NULL,
  description TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assignment_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  position INTEGER NOT NULL DEFAULT 0
);

-- one row per student per assignment
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','reviewed')),
  score REAL,
  submitted_at TEXT,
  reviewed_at TEXT,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE submission_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  -- raw student answer as JSON (chosen option index, matched pairs, base64 audio/image, drawing strokes, etc.)
  answer_json TEXT NOT NULL,
  is_correct INTEGER,   -- computed server-side only; NULL until graded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_class ON users(class_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_question_bank_school ON question_bank(school_id);
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
