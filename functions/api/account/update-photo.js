import { json, err } from '../_lib/http.js';

// عکس‌ها سمت کلاینت (canvas) کوچک و فشرده می‌شن قبل از ارسال؛ اینجا هم یه سقف سخت‌گیرانه می‌ذاریم
// چون بدون R2 مستقیم توی D1 (به‌صورت TEXT/base64) ذخیره می‌شه — هم‌راستا با بقیهٔ مدیای این پروژه.
const MAX_PHOTO_CHARS = 300000; // ~225KB decoded — کافیه برای یک عکس پروفایل کوچک فشرده‌شده

export async function onRequestPost({ request, env, data }) {
  const user = data.user;

  const body = await request.json().catch(() => null);
  if (body?.photo === null) {
    // حذف عکس و برگشت به آواتار
    await env.DB.prepare('UPDATE users SET avatar_photo = NULL WHERE id = ?').bind(user.id).run();
    return json({ ok: true, photo: null });
  }

  if (!body?.photo || typeof body.photo !== 'string' || !body.photo.startsWith('data:image/')) {
    return err('photo must be a data:image/... base64 string, or null to remove');
  }
  if (body.photo.length > MAX_PHOTO_CHARS) return err(`photo exceeds ${MAX_PHOTO_CHARS} characters after compression`, 400);

  await env.DB.prepare('UPDATE users SET avatar_photo = ? WHERE id = ?').bind(body.photo, user.id).run();
  return json({ ok: true, photo: body.photo });
}
