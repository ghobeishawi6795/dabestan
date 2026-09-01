// «قالب‌های آماده» — چند بستهٔ نمونهٔ سؤال به تفکیک پایه/درس، برای معلم‌های تازه‌کار که
// بانک سؤالشون خالیه. هر بسته عمداً چند نوع سؤال متفاوت داره (شبیه creative_bank badge)
// تا هم تنوع Task Runtime رو نشون بده هم مستقیم به نشان معلم کمک کنه.
// content_json هر سؤال دقیقاً هم‌شکل چیزیه که grading.js انتظار داره (بدون نیاز به تغییر بک‌اند گریدینگ).

export const TEMPLATE_PACKS = [
  {
    id: 'math-grade2',
    name: 'ریاضی — پایهٔ دوم',
    subject: 'ریاضی',
    grade: 2,
    description: 'جمع و تفریق ساده، ترتیب اعداد، و آشنایی با اعداد نوشتاری.',
    questions: [
      {
        title: 'جمع ساده',
        questionType: 'multiple_choice',
        difficulty: 'easy',
        tags: ['جمع'],
        content: { prompt: '۵ + ۳ چند می‌شه؟', options: ['۶', '۷', '۸', '۹'], correctIndex: 2 },
      },
      {
        title: 'مقایسهٔ اعداد',
        questionType: 'true_false',
        difficulty: 'easy',
        tags: ['مقایسه'],
        content: { prompt: '۱۰ از ۵ بزرگ‌تره.', correct: true },
      },
      {
        title: 'عدد بعدی',
        questionType: 'fill_blank',
        difficulty: 'easy',
        tags: ['شمارش'],
        content: { prompt: 'عدد بعد از ۹، ___ است.', answer: '۱۰' },
      },
      {
        title: 'ترتیب اعداد',
        questionType: 'ordering',
        difficulty: 'medium',
        tags: ['ترتیب'],
        content: { prompt: 'اعداد رو از کوچک به بزرگ مرتب کن.', pairs: [{ left: '۲' }, { left: '۵' }, { left: '۷' }, { left: '۹' }] },
      },
      {
        title: 'عدد و نوشتار',
        questionType: 'matching',
        difficulty: 'medium',
        tags: ['اعداد نوشتاری'],
        content: { prompt: 'هر عدد رو به نوشتارش وصل کن.', pairs: [{ left: '۱', right: 'یک' }, { left: '۲', right: 'دو' }, { left: '۳', right: 'سه' }] },
      },
    ],
  },
  {
    id: 'persian-grade1',
    name: 'فارسی — پایهٔ اول',
    subject: 'فارسی',
    grade: 1,
    description: 'آشنایی با حروف، ساخت کلمه، و متضادهای ساده.',
    questions: [
      {
        title: 'شروع با یه حرف',
        questionType: 'multiple_choice',
        difficulty: 'easy',
        tags: ['حروف'],
        content: { prompt: 'کدوم کلمه با «آ» شروع می‌شه؟', options: ['آب', 'توپ', 'مار', 'سیب'], correctIndex: 0 },
      },
      {
        title: 'حرف اول کلمه',
        questionType: 'true_false',
        difficulty: 'easy',
        tags: ['حروف'],
        content: { prompt: '«کتاب» با حرف «ک» شروع می‌شه.', correct: true },
      },
      {
        title: 'جای خالی',
        questionType: 'fill_blank',
        difficulty: 'easy',
        tags: ['واژه‌سازی'],
        content: { prompt: 'جای خالی رو با حرف درست پر کن تا «آفتاب» ساخته بشه: ___ فتاب', answer: 'آ' },
      },
      {
        title: 'ساخت کلمه',
        questionType: 'ordering',
        difficulty: 'medium',
        tags: ['واژه‌سازی'],
        content: { prompt: 'حروف رو به‌ترتیب بچین تا کلمهٔ «مادر» ساخته بشه.', pairs: [{ left: 'م' }, { left: 'ا' }, { left: 'د' }, { left: 'ر' }] },
      },
      {
        title: 'متضادها',
        questionType: 'matching',
        difficulty: 'medium',
        tags: ['متضاد'],
        content: { prompt: 'هر کلمه رو به متضادش وصل کن.', pairs: [{ left: 'بزرگ', right: 'کوچک' }, { left: 'روز', right: 'شب' }, { left: 'بالا', right: 'پایین' }] },
      },
    ],
  },
  {
    id: 'science-grade3',
    name: 'علوم — پایهٔ سوم',
    subject: 'علوم',
    grade: 3,
    description: 'حالت‌های ماده، منظومهٔ شمسی، و رشد گیاه.',
    questions: [
      {
        title: 'حالت‌های ماده',
        questionType: 'multiple_choice',
        difficulty: 'easy',
        tags: ['حالت ماده'],
        content: { prompt: 'کدوم‌یک از این‌ها حالت جامد داره؟', options: ['آب', 'یخ', 'بخار', 'هوا'], correctIndex: 1 },
      },
      {
        title: 'خورشید',
        questionType: 'true_false',
        difficulty: 'easy',
        tags: ['منظومهٔ شمسی'],
        content: { prompt: 'خورشید یه ستاره‌ست.', correct: true },
      },
      {
        title: 'رشد گیاه',
        questionType: 'fill_blank',
        difficulty: 'easy',
        tags: ['گیاهان'],
        content: { prompt: 'گیاهان برای رشد به نور ___ نیاز دارن.', answer: 'خورشید' },
      },
      {
        title: 'مراحل رشد گیاه',
        questionType: 'ordering',
        difficulty: 'medium',
        tags: ['گیاهان'],
        content: { prompt: 'مراحل رشد گیاه رو به‌ترتیب بچین.', pairs: [{ left: 'بذر' }, { left: 'جوانه' }, { left: 'نهال' }, { left: 'درخت' }] },
      },
      {
        title: 'جانور و زیستگاه',
        questionType: 'matching',
        difficulty: 'medium',
        tags: ['زیستگاه'],
        content: { prompt: 'هر جانور رو به زیستگاهش وصل کن.', pairs: [{ left: 'ماهی', right: 'آب' }, { left: 'پرنده', right: 'آسمان' }, { left: 'شیر', right: 'جنگل' }] },
      },
    ],
  },
];

export function getTemplatePack(packId) {
  return TEMPLATE_PACKS.find((p) => p.id === packId) || null;
}
