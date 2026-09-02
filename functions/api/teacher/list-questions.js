import { json, err } from '../_lib/http.js';

export async function onRequestGet({ request, env, data }) {
  const teacher = data.user;
  if (teacher.role !== 'teacher') return err('forbidden', 403);

  const url = new URL(request.url);
  const own = url.searchParams.get('own') === 'school' ? 'school' : 'me';
  const subject = url.searchParams.get('subject') || '';
  const grade = url.searchParams.get('grade') || '';
  const type = url.searchParams.get('type') || '';
  const difficulty = url.searchParams.get('difficulty') || '';
  const tag = (url.searchParams.get('tag') || '').trim();
  const chapter = (url.searchParams.get('chapter') || '').trim();
  const topic = (url.searchParams.get('topic') || '').trim();
  const status = url.searchParams.get('status') || '';
  const favoriteOnly = url.searchParams.get('favorite') === '1';
  const search = (url.searchParams.get('search') || '').trim();
  const sort = url.searchParams.get('sort') || 'newest';

  const where = ['q.school_id = ?'];
  const binds = [teacher.school_id];
  if (own === 'me') { where.push('q.teacher_id = ?'); binds.push(teacher.id); }
  if (subject) { where.push('q.subject = ?'); binds.push(subject); }
  if (grade) { where.push('q.grade = ?'); binds.push(Number(grade)); }
  if (type) { where.push('q.question_type = ?'); binds.push(type); }
  if (difficulty) { where.push('q.difficulty = ?'); binds.push(difficulty); }
  if (status) { where.push('q.status = ?'); binds.push(status); }
  if (chapter) { where.push('q.chapter LIKE ?'); binds.push(`%${chapter}%`); }
  if (topic) { where.push('q.topic LIKE ?'); binds.push(`%${topic}%`); }
  if (tag) { where.push("((',' || REPLACE(q.tags, ' ', '') || ',') LIKE ?"); binds.push(`%,${tag.replace(/\s/g, '')},%`); }
  if (favoriteOnly) { where.push('q.is_favorite = 1'); }
  if (search) {
    where.push('(q.title LIKE ? OR q.content_json LIKE ? OR q.tags LIKE ? OR q.topic LIKE ?)');
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const order = sort === 'popular' ? 'answer_count DESC'
              : sort === 'success' ? 'success_rate DESC'
              : sort === 'title' ? 'q.title ASC'
              : sort === 'favorite' ? 'q.is_favorite DESC, q.id DESC'
              : 'q.id DESC';

  const { results } = await env.DB.prepare(
    `SELECT q.id, q.question_type, q.subject, q.grade, q.title, q.content_json, q.teacher_id,
            q.tags, q.is_favorite, q.difficulty, q.chapter, q.topic, q.explanation, q.status, q.version,
            t.full_name AS author_name,
            (SELECT COUNT(*) FROM assignment_questions aq WHERE aq.question_id = q.id) AS usage_count,
            (SELECT COUNT(*) FROM submission_answers sa WHERE sa.question_id = q.id) AS answer_count,
            (SELECT ROUND(AVG(sa.is_correct) * 100) FROM submission_answers sa WHERE sa.question_id = q.id AND sa.is_correct IS NOT NULL) AS success_rate,
            (SELECT MAX(sub.submitted_at) FROM submission_answers sa JOIN submissions sub ON sub.id = sa.submission_id WHERE sa.question_id = q.id) AS last_used_at
     FROM question_bank q JOIN users t ON t.id = q.teacher_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT 200`
  ).bind(...binds).all();

  return json({ questions: results });
}
