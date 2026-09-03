import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const challenge = await env.DB.prepare(
    `SELECT dc.*, 
            (SELECT COUNT(*) FROM challenge_participants cp WHERE cp.challenge_id = dc.id AND cp.completed = 1) AS participant_count,
            (SELECT cp.completed FROM challenge_participants cp WHERE cp.challenge_id = dc.id AND cp.student_id = ?) AS my_completed
     FROM daily_challenges dc
     WHERE dc.school_id = ? AND dc.challenge_date = ?`
  ).bind(student.id, student.school_id, date).first();

  return json({ challenge: challenge || null });
}
