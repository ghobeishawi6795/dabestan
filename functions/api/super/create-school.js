import { json, err } from '../_lib/http.js';
import { hashPassword } from '../_lib/auth.js';

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { schoolName, city, adminFullName, adminUsername, adminPassword } = body;
  if (!schoolName || !adminFullName || !adminUsername || !adminPassword) {
    return err('schoolName, adminFullName, adminUsername, adminPassword are required');
  }
  if (adminPassword.length < 8) return err('password must be at least 8 characters');

  const school = await env.DB.prepare('INSERT INTO schools (name, city) VALUES (?, ?) RETURNING id')
    .bind(schoolName, city || null).first();

  const { hash, salt } = await hashPassword(adminPassword);

  await env.DB.prepare(
    `INSERT INTO users (school_id, role, username, password_hash, password_salt, full_name, is_active)
     VALUES (?, 'admin', ?, ?, ?, ?, 1)`
  ).bind(school.id, adminUsername, hash, salt, adminFullName).run();

  return json({ ok: true, schoolId: school.id });
}
