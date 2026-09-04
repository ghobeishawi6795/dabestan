CREATE TABLE IF NOT EXISTS student_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  skill_id INTEGER NOT NULL REFERENCES learning_skills(id),
  title TEXT NOT NULL,
  description TEXT,
  target_mastery REAL NOT NULL DEFAULT 80,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_student_goals_student
ON student_goals(student_id);

CREATE INDEX IF NOT EXISTS idx_student_goals_skill
ON student_goals(student_id, skill_id);

CREATE INDEX IF NOT EXISTS idx_student_goals_school
ON student_goals(school_id);
