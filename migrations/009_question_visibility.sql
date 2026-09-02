-- 009: visibility for public bank
ALTER TABLE question_bank ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
