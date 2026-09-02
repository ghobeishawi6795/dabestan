-- 008: question bank v2 — metadata + versioning + status
ALTER TABLE question_bank ADD COLUMN chapter TEXT;
ALTER TABLE question_bank ADD COLUMN topic TEXT;
ALTER TABLE question_bank ADD COLUMN explanation TEXT;
ALTER TABLE question_bank ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE question_bank ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

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

ALTER TABLE assignment_questions ADD COLUMN pinned_version INTEGER;

CREATE INDEX IF NOT EXISTS idx_question_versions_question ON question_versions(question_id, version);
CREATE INDEX IF NOT EXISTS idx_question_bank_status ON question_bank(school_id, status);
