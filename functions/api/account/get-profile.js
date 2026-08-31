import { json } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const user = data.user;
  const row = await env.DB.prepare(
    `SELECT u.full_name, u.avatar, u.avatar_photo, s.theme_color AS school_theme_color
     FROM users u JOIN schools s ON s.id = u.school_id WHERE u.id = ?`
  ).bind(user.id).first();
  return json({ fullName: row.full_name, avatar: row.avatar, avatarPhoto: row.avatar_photo, schoolThemeColor: row.school_theme_color });
}
