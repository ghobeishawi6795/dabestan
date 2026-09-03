-- 011: حذف کامل حیوان خانگی، سکه/فروشگاه، نبرد ریاضی، و کارت‌های جمع‌آوری
-- ⚠️ این مایگریشن مخرب و غیرقابل‌بازگشت است. قبل از اجرا روی D1 زنده،
--    حتماً یک بک‌آپ بگیرید:
--    npx wrangler d1 export <DB_NAME> --output=backup-before-011.sql
--
-- ترتیب رعایت‌شده به‌خاطر PRAGMA foreign_keys = ON است:
-- جدول‌های وابسته (duel_questions/duel_answers) قبل از duels حذف می‌شوند.

DROP TABLE IF EXISTS duel_questions;
DROP TABLE IF EXISTS duel_answers;
DROP TABLE IF EXISTS duels;
DROP TABLE IF EXISTS shop_purchases;
DROP TABLE IF EXISTS pets;

-- نشان «قهرمان نبرد» دیگر قابل کسب نیست؛ رکوردهای قبلی‌اش هم حذف می‌شود.
DELETE FROM user_badges WHERE badge_code = 'duel_champion';
DELETE FROM badges WHERE code = 'duel_champion';

-- ستون سکه از داشبورد چالش روزانه حذف می‌شود (سکه دیگر ارز نیست).
ALTER TABLE daily_challenges DROP COLUMN reward_coins;

-- سوئیچ «کارت معافیت» چون کاملاً به فروشگاه/سکه وابسته بود، بی‌معنی شده.
ALTER TABLE schools DROP COLUMN skip_cards_enabled;

-- ستون سکه از خود کاربران. طبق تصمیم شما، بدون تبدیل به growth_points حذف می‌شود.
ALTER TABLE users DROP COLUMN coins;
