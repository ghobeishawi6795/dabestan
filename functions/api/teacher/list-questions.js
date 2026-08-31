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
  if (tag) { where.push('(\',\' || REPLACE(q.tags, \' \', \'\') || \',\') LIKE ?'); binds.push(`%,${tag.replace(/\s/g, '')},%`); }
  if (favoriteOnly) { where.push('q.is_favorite = 1'); }
  if (search) {
    where.push('(q.title LIKE ? OR q.content_json LIKE ? OR q.tags LIKE ?)');
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const order = sort === 'popular' ? 'usage_count DESC'
              : sort === 'title' ? 'q.title ASC'
              : sort === 'favorite' ? 'q.is_favorite DESC, q.id DESC'
              : 'q.id DESC';

  const { results } = await env.DB.prepare(
    `SELECT q.id, q.question_type, q.subject, q.grade, q.title, q.content_json, q.teacher_id,
            q.tags, q.is_favorite, q.difficulty,
            t.full_name AS author_name,
            (SELECT COUNT(*) FROM assignment_questions aq WHERE aq.question_id = q.id) AS usage_count
     FROM question_bank q JOIN users t ON t.id = q.teacher_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT 200`
  ).bind(...binds).all();

  return json({ questions: results });
}
