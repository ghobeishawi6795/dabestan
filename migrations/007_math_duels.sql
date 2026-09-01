-- Migration 007: math duels (⚔️) — async 1v1 arithmetic challenge between two classmates.
-- No websockets/cron on Cloudflare Pages, so this is deliberately poll-based: the client
-- re-fetches duel state every few seconds while a duel is pending/active.

-- ── یک نبرد بین دو دانش‌آموز هم‌کلاسی ─────────────────────────────────────
CREATE TABLE duels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  challenger_id INTEGER NOT NULL REFERENCES users(id),
  opponent_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','finished','declined')),
  question_count INTEGER NOT NULL DEFAULT 5,
  winner_id INTEGER REFERENCES users(id),  -- NULL هم برای «هنوز تمام نشده» هم برای «مساوی» — status تعیین‌کننده‌ست
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,   -- وقتی حریف قبول می‌کنه پر می‌شه
  finished_at TEXT
);
CREATE INDEX idx_duels_challenger ON duels(challenger_id, status);
CREATE INDEX idx_duels_opponent ON duels(opponent_id, status);

-- ── سؤالای هر نبرد — سمت سرور ساخته می‌شن، برای هر دو نفر یکسانه (عادلانه) ─
-- پاسخ درست (answer) هیچ‌وقت به کلاینت فرستاده نمی‌شه، فقط عملوندها.
CREATE TABLE duel_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  position INTEGER NOT NULL,
  operand_a INTEGER NOT NULL,
  operand_b INTEGER NOT NULL,
  operator TEXT NOT NULL,  -- '+' | '-' | '×'
  answer INTEGER NOT NULL,
  UNIQUE (duel_id, position)
);

-- ── پاسخ هر دانش‌آموز به هر سؤال یک نبرد ──────────────────────────────────
CREATE TABLE duel_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  position INTEGER NOT NULL,
  submitted_answer INTEGER,
  is_correct INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (duel_id, student_id, position)
);
CREATE INDEX idx_duel_answers_duel_student ON duel_answers(duel_id, student_id);

-- ── نشان قهرمان نبرد ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO badges (code, name, icon, description) VALUES
  ('duel_champion', 'قهرمان نبرد', '⚔️', 'سه نبرد ریاضی رو بردی');
