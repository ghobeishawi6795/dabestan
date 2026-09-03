-- 012: Learning Domain

CREATE TABLE IF NOT EXISTS learning_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  subject TEXT NOT NULL,
  grade INTEGER,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES learning_skills(id),
  position INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS question_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES question_bank(id),
  skill_id INTEGER NOT NULL REFERENCES learning_skills(id),
  weight REAL NOT NULL DEFAULT 1,
  UNIQUE (question_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_skills_school
ON learning_skills(school_id, is_active);

CREATE INDEX IF NOT EXISTS idx_learning_skills_parent
ON learning_skills(parent_id);

CREATE INDEX IF NOT EXISTS idx_question_skills_question
ON question_skills(question_id);

CREATE INDEX IF NOT EXISTS idx_question_skills_skill
ON question_skills(skill_id);
