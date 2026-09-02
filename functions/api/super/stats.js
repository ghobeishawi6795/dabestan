import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const schools = await env.DB.prepare('SELECT COUNT(*) AS n FROM schools').first();
  const teachers = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher'").first();
  const students = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").first();
  const questions = await env.DB.prepare('SELECT COUNT(*) AS n FROM question_bank').first();
  const assignments = await env.DB.prepare('SELECT COUNT(*) AS n FROM assignments').first();

  return json({ stats: { schools: schools.n, teachers: teachers.n, students: students.n, questions: questions.n, assignments: assignments.n } });
}
