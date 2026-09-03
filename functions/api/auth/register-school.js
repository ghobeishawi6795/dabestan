import { json, err } from '../_lib/http.js';
import { hashPassword } from '../_lib/auth.js';

// Each call creates a brand-new school + its admin — correctly multi-tenant from the start.
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');

  const { schoolName, adminUsername, adminPassword, adminFullName } = body;
  if (!schoolName || !adminUsername || !adminPassword || !adminFullName) {
    return err('schoolName, adminUsername, adminPassword, adminFullName are required');
  }

  if (
    typeof schoolName !== 'string' ||
    typeof adminUsername !== 'string' ||
    typeof adminPassword !== 'string' ||
    typeof adminFullName !== 'string'
  ) {
    return err('invalid input');
  }

  if (schoolName.trim().length < 2 || schoolName.length > 120) {
    return err('schoolName must be between 2 and 120 characters');
  }

  if (adminUsername.length < 2 || adminUsername.length > 80) {
    return err('adminUsername must be between 2 and 80 characters');
  }

  if (adminFullName.trim().length < 2 || adminFullName.length > 120) {
    return err('adminFullName must be between 2 and 120 characters');
  }

  if (adminPassword.length < 8 || adminPassword.length > 200) {
    return err('password must be between 8 and 200 characters');
  }

  const school = await env.DB.prepare('INSERT INTO schools (name) VALUES (?) RETURNING id')
    .bind(schoolName)
    .first();

  const { hash, salt } = await hashPassword(adminPassword);

  // ✅ اصلاح: بررسی تکراری بودن فقط داخل همین مدرسه (با school_id)
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
