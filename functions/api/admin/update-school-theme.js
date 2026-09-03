import { json, err } from '../_lib/http.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);

  if (body?.themeColor === null) {
    await env.DB.prepare('UPDATE schools SET theme_color = NULL WHERE id = ?').bind(admin.school_id).run();
    return json({ ok: true, themeColor: null });
  }
  if (!body?.themeColor || !HEX_RE.test(body.themeColor)) return err('themeColor must be a hex color like #3F7A52, or null to reset');

  await env.DB.prepare('UPDATE schools SET theme_color = ? WHERE id = ?').bind(body.themeColor, admin.school_id).run();
  return json({ ok: true, themeColor: body.themeColor });
}
