import { json, err } from '../_lib/http.js';

// Public — needed so the login screen can resolve "school name" -> school_id before authenticating.
// Returns only id + name, nothing sensitive.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const nameQuery = (url.searchParams.get('name') || '').trim();
  if (!nameQuery) return err('name query param is required');

  const { results } = await env.DB.prepare(
    'SELECT id, name FROM schools WHERE name LIKE ? ORDER BY name LIMIT 10'
  ).bind(`%${nameQuery}%`).all();

  return json({ schools: results });
}
