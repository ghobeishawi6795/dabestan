-- Migration 006: pet companion + points shop + skip cards + collectible cards (tag-derived, no new table) + festival.

-- ── سکه: واحد پول قابل‌خرج (جدا از growth_points که فقط رشد نهال رو کنترل می‌کنه) ──
ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;

-- ── سوئیچ مدیر: فعال/غیرفعال بودن «کارت معافیت» در کل مدرسه ──────────────
ALTER TABLE schools ADD COLUMN skip_cards_enabled INTEGER NOT NULL DEFAULT 1;

-- ── معاف‌شده با کارت: تکلیفی که دانش‌آموز به‌جای پاسخ دادن با کارت معافیت رد کرده ──
ALTER TABLE submissions ADD COLUMN excused INTEGER NOT NULL DEFAULT 0;

-- ── حیوان خانگی: ساکن باغچه، کنار نهال رشد می‌کنه ────────────────────────
CREATE TABLE pets (
  student_id INTEGER PRIMARY KEY REFERENCES users(id),
  species TEXT NOT NULL,                    -- 'cat' | 'rabbit' | 'bird'
  accessories TEXT NOT NULL DEFAULT '[]',   -- JSON array of equipped accessory item_codes
  last_fed_at TEXT,                         -- هر تکلیف موفق = یک وعده غذا؛ دلتنگی بر اساس فاصلهٔ این تاریخ حساب می‌شه
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── خریدهای فروشگاه: هم اکسسوری (مالکیت دائم) هم کارت معافیت (اعتبار مصرفی) ──
-- item_type='accessory': هر ردیف یعنی مالکیت اون آیتم (خرید تکراری مسدوده در سرور).
-- item_type='skip_card': هر ردیف یک اعتبار مصرف‌نشده است تا used_at پر بشه (یعنی مصرف شده).
CREATE TABLE shop_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  item_code TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('accessory', 'skip_card')),
  used_at TEXT,                             -- فقط برای skip_card؛ NULL یعنی هنوز مصرف نشده
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shop_purchases_student ON shop_purchases(student_id);
CREATE INDEX idx_shop_purchases_skip_unused ON shop_purchases(student_id, item_type, used_at);

-- ── نشان جشنوارهٔ مهر ────────────────────────────────────────────────────
INSERT OR IGNORE INTO badges (code, name, icon, description) VALUES
  ('mehregan_1405', 'نشان مهرگان', '🍂', 'توی جشنوارهٔ مهر حداقل یک تکلیف فرستادی');
