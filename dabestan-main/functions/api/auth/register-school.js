import { hashPassword } from '../_lib/auth.js';
import { json, err } from '../_lib/http.js';

// Each call creates a brand-new school + its admin — correctly multi-tenant from the start
// (earlier project's bug: single global admin check with no school_id scoping).
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { schoolName, adminUsername, adminPassword, adminFullName } = body;
  if (!schoolName || !adminUsername || !adminPassword || !adminFullName) {
    return err('schoolName, adminUsername, adminPassword, adminFullName are required');
  }
  if (adminPassword.length < 8) return err('password must be at least 8 characters');

  const school = await env.DB.prepare('INSERT INTO schools (name) VALUES (?) RETURNING id')
    .bind(schoolName)
    .first();

  const { hash, salt } = await hashPassword(adminPassword);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE school_id = ? AND username = ?')
    .bind(school.id, adminUsername)
    .first();
  if (existing) return err('username already taken in this school', 409);

  await env.DB.prepare(
    `INSERT INTO users (school_id, role, username, password_hash, password_salt, full_name)
     VALUES (?, 'admin', ?, ?, ?, ?)`
  ).bind(school.id, adminUsername, hash, salt, adminFullName).run();

  return json({ ok: true, schoolId: school.id });
}
