import { json, err } from '../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const admin = data.user;
  if (admin.role !== 'admin') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  if (!body?.classId) return err('classId is required');

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?')
    .bind(body.classId, admin.school_id).first();
  if (!cls) return err('class not found', 404);

  const studentCount = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE class_id = ? AND role = 'student'`)
    .bind(body.classId).first();
  if (studentCount.n > 0) return err('این کلاس دانش‌آموز دارد — اول دانش‌آموزها را جابه‌جا یا حذف کن', 409);

  const assignmentCount = await env.DB.prepare('SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?')
    .bind(body.classId).first();
  if (assignmentCount.n > 0) return err('این کلاس تکلیف دارد — اول تکلیف‌ها را حذف کن', 409);

  await env.DB.prepare('DELETE FROM lessons WHERE class_id = ?').bind(body.classId).run();
  await env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(body.classId).run();

  return json({ ok: true });
}
