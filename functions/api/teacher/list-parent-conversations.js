import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT s.id AS studentId, s.full_name AS studentName,
            (SELECT body FROM parent_messages pm WHERE pm.student_id = s.id AND pm.teacher_id = ? ORDER BY pm.id DESC LIMIT 1) AS lastMessage,
            (SELECT created_at FROM parent_messages pm WHERE pm.student_id = s.id AND pm.teacher_id = ? ORDER BY pm.id DESC LIMIT 1) AS lastAt,
            (SELECT COUNT(*) FROM parent_messages pm WHERE pm.student_id = s.id AND pm.teacher_id = ? AND pm.sender = 'parent' AND pm.is_read = 0) AS unreadCount
     FROM users s JOIN classes c ON c.id = s.class_id
     WHERE c.teacher_id = ? AND s.role = 'student' AND s.is_active = 1
       AND EXISTS (SELECT 1 FROM parent_messages pm WHERE pm.student_id = s.id AND pm.teacher_id = ?)
     ORDER BY lastAt DESC`
  ).bind(teacher.id, teacher.id, teacher.id, teacher.id, teacher.id).all();

  return json({ conversations: results });
}
