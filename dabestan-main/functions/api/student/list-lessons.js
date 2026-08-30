import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);
  if (!student.class_id) return json({ lessons: [] });

  const { results: lessons } = await env.DB.prepare(
    'SELECT id, subject, title, icon, position FROM lessons WHERE class_id = ? ORDER BY position ASC'
  ).bind(student.class_id).all();

  const out = [];
  let previousComplete = true; // lesson اول همیشه باز است
  for (const lesson of lessons) {
    const { results: linked } = await env.DB.prepare(
      `SELECT a.id, sub.status, sub.score FROM lesson_assignments la
       JOIN assignments a ON a.id = la.assignment_id
       LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
       WHERE la.lesson_id = ? ORDER BY la.position ASC`
    ).bind(student.id, lesson.id).all();

    const total = linked.length;
    const done = linked.filter((l) => l.status === 'submitted' || l.status === 'reviewed').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const avgScore = total > 0 ? Math.round(linked.reduce((s, l) => s + (l.score || 0), 0) / total) : 0;
    const stars = avgScore >= 90 ? 3 : avgScore >= 70 ? 2 : avgScore >= 40 ? 1 : 0;

    out.push({
      id: lesson.id, subject: lesson.subject, title: lesson.title, icon: lesson.icon,
      totalAssignments: total, doneAssignments: done, progress, stars,
      status: !previousComplete ? 'locked' : (done === total && total > 0 ? 'done' : 'current'),
    });
    previousComplete = total > 0 && done === total;
  }

  return json({ lessons: out });
}
