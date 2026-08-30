-- Migration 003: teacher achievement badges — reuses badges/user_badges (already role-agnostic).

INSERT INTO badges (code, name, icon, description) VALUES
  ('first_assignment', 'سرآغاز', '🌱', 'اولین تکلیف را برای دانش‌آموزان ارسال کردی'),
  ('ten_assignments', 'معلم پرکار', '📚', '۱۰ تکلیف ارسال کردی'),
  ('quick_grader', 'تصحیح سریع', '⚡', 'میانگین زمان تصحیحت زیر ۲۴ ساعت است'),
  ('creative_bank', 'معلم خلاق', '🎨', 'از ۵ نوع سؤال مختلف در بانک سؤال استفاده کردی'),
  ('popular_teacher', 'محبوب والدین', '💛', 'میانگین رضایت والدین بالای ۴٫۵ از ۵ (حداقل ۵ نظر)'),
  ('lesson_builder', 'برنامه‌ریز', '🗺️', 'اولین فصل درسی را ساختی');
