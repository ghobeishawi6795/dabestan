-- 013: Learning Progress indexes

CREATE INDEX IF NOT EXISTS idx_question_skills_skill_question
ON question_skills(skill_id, question_id);

CREATE INDEX IF NOT EXISTS idx_submissions_student_status
ON submissions(student_id, status, reviewed_at);

CREATE INDEX IF NOT EXISTS idx_submission_answers_submission_question
ON submission_answers(submission_id, question_id, id);

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_class
ON assignments(teacher_id, school_id, class_id);

CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment_question
ON assignment_questions(assignment_id, question_id);
