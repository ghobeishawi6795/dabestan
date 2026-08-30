// گریدینگ همیشه اینجا (سمت سرور) انجام می‌شه — کلید پاسخ هرگز به مرورگر دانش‌آموز فرستاده نمی‌شه.

const MAX_MEDIA_CHARS = 400000; // ~300KB decoded — base64 audio/photo/drawing data URLs, D1-friendly size cap
const MAX_CUSTOM_HTML_CHARS = 50000; // teacher-authored custom_html fragment size cap

function normalize(s) {
  return String(s ?? '').trim().toLowerCase();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const CUSTOM_HTML_MAX_CHARS = MAX_CUSTOM_HTML_CHARS;

// چیزی که برای دانش‌آموز فرستاده می‌شه — بدون کلید پاسخ
export function stripAnswerKey(question) {
  const content = JSON.parse(question.content_json);
  const base = { id: question.id, type: question.question_type, title: question.title, prompt: content.prompt };

  switch (question.question_type) {
    case 'multiple_choice':
      return { ...base, options: content.options };
    case 'matching':
    case 'drag_connect':
      return {
        ...base,
        leftItems: (content.pairs || []).map((p) => p.left),
        rightItems: shuffle((content.pairs || []).map((p) => p.right)),
      };
    case 'ordering':
      return { ...base, items: shuffle((content.pairs || []).map((p) => p.left)) };
    case 'custom_html':
      // فقط fragment HTML رو می‌فرستیم — هیچ‌وقت داخل session/localStorage صفحهٔ اصلی اجرا نمی‌شه،
      // چون Task Runtime این رو فقط داخل iframe با sandbox="allow-scripts" (بدون allow-same-origin) رندر می‌کنه.
      return { ...base, customHtml: question.custom_html || '' };
    default:
      // true_false, fill_blank, drawing, coloring, audio_record, photo_upload — no answer key to strip
      return base;
  }
}

function mediaTooLarge(answer) {
  const raw = typeof answer === 'string' ? answer : (answer?.dataUrl || '');
  return raw.length > MAX_MEDIA_CHARS;
}

function payloadTooLarge(answer) {
  try { return JSON.stringify(answer ?? '').length > MAX_MEDIA_CHARS; }
  catch { return true; }
}

// برمی‌گردونه: { autoGraded: bool, correct: bool|null, error?: string }
export function gradeAnswer(question, answer) {
  const content = JSON.parse(question.content_json);

  switch (question.question_type) {
    case 'multiple_choice':
      return { autoGraded: true, correct: Number(answer) === content.correctIndex };

    case 'true_false':
      return { autoGraded: true, correct: Boolean(answer) === Boolean(content.correct) };

    case 'fill_blank':
      return { autoGraded: true, correct: normalize(answer) === normalize(content.answer) };

    case 'matching':
    case 'drag_connect': {
      const correctSet = new Set((content.pairs || []).map((p) => `${p.left}=>${p.right}`));
      const submitted = Array.isArray(answer) ? answer : [];
      const submittedSet = new Set(submitted.map((p) => `${p?.left}=>${p?.right}`));
      const correct = correctSet.size === submittedSet.size && [...correctSet].every((x) => submittedSet.has(x));
      return { autoGraded: true, correct };
    }

    case 'ordering': {
      const correctOrder = (content.pairs || []).map((p) => p.left);
      const submitted = Array.isArray(answer) ? answer : [];
      const correct = correctOrder.length === submitted.length && correctOrder.every((v, i) => v === submitted[i]);
      return { autoGraded: true, correct };
    }

    case 'drawing':
    case 'coloring':
    case 'audio_record':
    case 'photo_upload':
      if (mediaTooLarge(answer)) return { autoGraded: false, correct: null, error: 'media too large' };
      return { autoGraded: false, correct: null }; // manually graded by the teacher later

    case 'custom_html':
      // بدون کلید پاسخ ساختاریافته — همیشه دستی نمره‌دهی می‌شه، فقط سایز پاسخ رو محدود می‌کنیم.
      if (payloadTooLarge(answer)) return { autoGraded: false, correct: null, error: 'answer payload too large' };
      return { autoGraded: false, correct: null };

    default:
      return { autoGraded: false, correct: null };
  }
}
