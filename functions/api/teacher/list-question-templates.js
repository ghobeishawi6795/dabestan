import { json, err } from '../_lib/http.js';
import { TEMPLATE_PACKS } from '../_lib/question-templates.js';

export async function onRequestGet({ data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  // فقط متادیتا — محتوای کامل سؤالات لازم نیست تا وقتی معلم واقعاً import نزده.
  const packs = TEMPLATE_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    subject: p.subject,
    grade: p.grade,
    description: p.description,
    questionCount: p.questions.length,
    types: [...new Set(p.questions.map((q) => q.questionType))],
  }));

  return json({ packs });
}
