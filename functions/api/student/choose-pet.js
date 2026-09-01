import { json, err } from '../_lib/http.js';
import { isValidSpecies } from '../_lib/shop.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.species || !isValidSpecies(body.species)) return err('species is not valid');

  const existing = await env.DB.prepare('SELECT student_id FROM pets WHERE student_id = ?').bind(student.id).first();
  if (existing) return err('a pet was already chosen', 409);

  await env.DB.prepare('INSERT INTO pets (student_id, species, accessories, last_fed_at) VALUES (?, ?, \'[]\', ?)')
    .bind(student.id, body.species, new Date().toISOString()).run();

  return json({ ok: true, species: body.species });
}
