import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const schoolId = new URL(request.url).searchParams.get('schoolId');
  if (!schoolId) return err('schoolId required');

  const { results } = await env.DB.prepare(
    `SELECT id, username, full_name, is_active FROM users WHERE school_id = ? AND role = 'admin' ORDER BY id ASC`
  ).bind(schoolId).all();

  return json({ admins: results });
}
