CREATE TABLE IF NOT EXISTS student_skill_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  skill_id INTEGER NOT NULL REFERENCES learning_skills(id),
  correct_count INTEGER NOT NULL DEFAULT 0,
  answer_count INTEGER NOT NULL DEFAULT 0,
  mastery REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (submission_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_student_skill_results_student
ON student_skill_results(student_id, skill_id);

CREATE INDEX IF NOT EXISTS idx_student_skill_results_skill
ON student_skill_results(skill_id);

