-- 010: daily challenges + high fives + parent notes
CREATE TABLE IF NOT EXISTS daily_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  title TEXT NOT NULL,
  description TEXT,
  challenge_date TEXT NOT NULL,
  reward_coins INTEGER NOT NULL DEFAULT 10,
  reward_xp INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, challenge_date)
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (challenge_id, student_id)
);

CREATE TABLE IF NOT EXISTS high_fives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_student_id INTEGER NOT NULL REFERENCES users(id),
  to_student_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parent_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  parent_name TEXT NOT NULL,
  note TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_school_date ON daily_challenges(school_id, challenge_date);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_student ON challenge_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_high_fives_from ON high_fives(from_student_id);
CREATE INDEX IF NOT EXISTS idx_high_fives_to ON high_fives(to_student_id);
CREATE INDEX IF NOT EXISTS idx_parent_notes_student ON parent_notes(student_id);
