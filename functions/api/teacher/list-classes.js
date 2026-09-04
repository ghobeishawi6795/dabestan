import { json, err } from '../_lib/http.js';

// کلاس‌هایی که معلم به آن‌ها تکلیف داده یا کلاس‌دار آن است — برای پرشدن
// dropdown انتخاب کلاس در بخش «تحلیل یادگیری کلاس».
export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (!teacher || teacher.role !== 'teacher') {
    return err('forbidden', 403);
  }

  const { results } = await env.DB.prepare(`
    SELECT DISTINCT c.id, c.name, c.grade
    FROM classes c
    WHERE c.school_id = ?
      AND (
        c.teacher_id = ?
        OR c.id IN (
          SELECT DISTINCT a.class_id
          FROM assignments a
          WHERE a.teacher_id = ?
        )
      )
    ORDER BY c.name ASC
  `).bind(teacher.school_id, teacher.id, teacher.id).all();

  return json({ ok: true, classes: results || [] });
}
