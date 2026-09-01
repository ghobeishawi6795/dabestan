// «حال‌وهوای باغچه» — نسخهٔ بصری و فوری‌تر از دفترچهٔ باغچه (garden-diary.js).
// به‌جای یه لیست روزانه، فقط یه آیکون+برچسب کوتاه از وضعیت کلی همین هفته می‌ده،
// بر اساس چند روز پیش آخرین تکلیف ارسال‌شده و چند بار این هفته (۷ روز اخیر) فعالیت بوده.
// لحن عمداً مثل mood حیوان خانگی (پت‌پنل): «دلتنگته»، نه «ول کردی» — تشویقی، نه سرزنشی.

export async function getGardenWeather(env, studentId) {
  const row = await env.DB.prepare(
    `SELECT MAX(submitted_at) AS last_at,
            SUM(CASE WHEN date(submitted_at) >= date('now', '-6 days') THEN 1 ELSE 0 END) AS week_count
     FROM submissions
     WHERE student_id = ? AND status IN ('submitted', 'reviewed')`
  ).bind(studentId).first();

  if (!row || !row.last_at) {
    return { code: 'new', icon: '🌱', label: 'هنوز شروع نکردی' };
  }

  const daysSince = Math.floor((Date.now() - new Date(row.last_at).getTime()) / 86400000);
  const weekCount = row.week_count || 0;

  if (daysSince <= 2 && weekCount >= 3) return { code: 'sunny', icon: '☀️', label: 'آفتابی — این‌هفته پرکار بودی' };
  if (daysSince <= 2) return { code: 'sunny', icon: '☀️', label: 'آفتابی — به‌تازگی سر زدی' };
  if (daysSince <= 4) return { code: 'partly', icon: '⛅', label: 'نیمه‌ابری — چند روزیه سر نزدی' };
  if (daysSince <= 7) return { code: 'cloudy', icon: '☁️', label: 'ابری — باغچه منتظرته' };
  return { code: 'rainy', icon: '🌧️', label: 'دلتنگته — خیلی وقته سر نزدی' };
}
