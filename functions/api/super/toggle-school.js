import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (!user.is_super) return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.schoolId || typeof body.enable !== 'boolean') return err('schoolId and enable required');

  if (body.schoolId === user.school_id && !body.enable) {
    return err('نمی‌توانید مدرسهٔ ستاد خودتان را غیرفعال کنید', 400);
  }

  await env.DB.prepare('UPDATE users SET is_active = ? WHERE school_id = ?')
    .bind(body.enable ? 1 : 0, body.schoolId).run();

  return json({ ok: true, schoolId: body.schoolId, enabled: body.enable });
}
