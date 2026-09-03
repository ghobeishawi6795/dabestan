import { json, err } from '../_lib/http.js';
import { hashPassword } from '../_lib/auth.js';

// فقط وقتی کار می‌کند که هیچ سوپرادمینی در سامانه وجود نداشته باشد.
// اولین نفری که این endpoint را صدا بزند، مالک سامانه می‌شود.
export async function onRequestPost({ request, env }) {
  const existingSuper = await env.DB.prepare(
    'SELECT id FROM users WHERE is_super = 1 LIMIT 1'
  ).first();
  if (existingSuper) return err('super admin already exists', 409);

  const body = await request.json().catch(() => null);
  if (!body) return err('invalid json');
  const { username, password, fullName, schoolName } = body;
  if (!username || !password || !fullName) {
    return err('username, password, fullName are required');
  }
  if (password.length < 8) return err('password must be at least 8 characters');

  // ساخت مدرسهٔ ستاد (برای تعلق school_id)
  const school = await env.DB.prepare(
    'INSERT INTO schools (name) VALUES (?) RETURNING id'
  ).bind(schoolName || 'ستاد مرکزی').first();

  const { hash, salt } = await hashPassword(password);

  // این INSERT به‌صورت اتمیک بررسی می‌کند که هنوز سوپرادمینی وجود نداشته باشد.
  // بنابراین دو درخواست همزمان نمی‌توانند هر دو از check اولیه عبور کنند.
  const created = await env.DB.prepare(
    `INSERT INTO users (school_id, role, username, password_hash, password_salt, full_name, is_super, is_active)
     SELECT ?, 'admin', ?, ?, ?, ?, 1, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM users WHERE is_super = 1 LIMIT 1
     )`
  ).bind(school.id, username, hash, salt, fullName).run();

  if (!created.meta?.changes) {
    return err('super admin already exists', 409);
  }

  return json({ ok: true, message: 'اولین سوپرادمین ساخته شد! حالا از تب «ورود» وارد شو.' });
}
