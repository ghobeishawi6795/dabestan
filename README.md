# Homework App (v1 skeleton)

## راه‌اندازی
```bash
wrangler d1 create homework-app-db          # database_id رو در wrangler.toml جایگزین کن
wrangler d1 execute homework-app-db --file=schema.sql --remote
wrangler pages secret put AUTH_SECRET       # با: openssl rand -hex 32
wrangler pages deploy public
```

## ساخته‌شده در این مرحله (هستهٔ Auth + مدیریت کاربران)
- `schema.sql` — تمام جداول اصلی (schools, users, classes, question_bank, assignments, submissions, ...)
- `functions/api/_lib/auth.js` — هش رمز عبور (PBKDF2) + توکن نشست HMAC، fail-closed اگر AUTH_SECRET نباشه
- `functions/api/_middleware.js` — بررسی نشست روی همهٔ `/api/*` به‌جز مسیرهای عمومی
- `functions/api/auth/register-school.js` — ساخت مدرسه + ادمین (هر بار یک مدرسهٔ جدید، بدون باگ تک‌ادمین)
- `functions/api/auth/login.js`
- `functions/api/admin/add-teacher.js`, `add-student.js`, `add-class.js` — همه با scoping بر اساس school_id

## هنوز ساخته نشده (مراحل بعدی)
- `functions/api/teacher/*` — ساخت/ارسال تکلیف، بانک سؤال، مرور تکالیف
- `functions/api/student/*` — دریافت تکلیف، ارسال پاسخ
- `functions/api/parent/*` — نمای فقط‌خواندنی با parent_code
- `public/task-runtime/` — پخش‌کنندهٔ تعاملی سؤالات (صوت/نقاشی/رنگ/کشیدن/جورکردن) + grading سمت سرور
- صفحات UI (`public/admin`, `public/teacher`, `public/student`, `public/parent`)
- انیمیشن رشد دانه/پرنده روی داشبورد دانش‌آموز

## تصمیم‌های امنیتی/معماری کلیدی
- بدون R2 — صوت/عکس محدودشده در حد اندازه، به‌صورت base64 در D1
- گریدینگ همیشه سمت سرور — کلید پاسخ هرگز به مرورگر دانش‌آموز فرستاده نمی‌شه
- هر HTML سفارشی معلم فقط داخل iframe با sandbox محدود اجرا می‌شه
