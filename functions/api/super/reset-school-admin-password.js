import { json, err } from '../_lib/http.js';
import { hashPassword } from '../_lib/auth.js';

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.adminId || !body?.newPassword) return err('adminId and newPassword are required');
  if (body.newPassword.length < 8) return err('password must be at least 8 characters');

  const admin = await env.DB.prepare(
    `SELECT id, username, school_id FROM users WHERE id = ? AND role = 'admin'`
  ).bind(body.adminId).first();
  if (!admin) return err('admin not found', 404);

  const { hash, salt } = await hashPassword(body.newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .bind(hash, salt, admin.id).run();

  return json({ ok: true, username: admin.username });
}
