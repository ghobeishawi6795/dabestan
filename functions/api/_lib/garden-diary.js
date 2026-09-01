// دفترچهٔ باغچه — یک خط خودکار برای هر روزی که دانش‌آموز فعالیتی داشته.
// چیزی ذخیره نمی‌شه: هر بار که باز می‌شه، از رویدادهای ۳۰ روز اخیر زنده ساخته می‌شه
// (مثل یادآوری‌های «موعد نزدیکه» — بدون cron، صرفاً وقتی کسی می‌بینتش محاسبه می‌شه).

const DAYS_BACK = 30;

export async function buildGardenDiary(env, studentId) {
  const since = `date('now', '-${DAYS_BACK} days')`;

  const { results: submissionRows } = await env.DB.prepare(
    `SELECT date(submitted_at) AS d, COUNT(*) AS n, AVG(score) AS avgScore
     FROM submissions WHERE student_id = ? AND submitted_at IS NOT NULL AND date(submitted_at) >= ${since}
     GROUP BY date(submitted_at)`
  ).bind(studentId).all();

  const { results: badgeRows } = await env.DB.prepare(
    `SELECT date(ub.earned_at) AS d, b.name, b.icon
     FROM user_badges ub JOIN badges b ON b.code = ub.badge_code
     WHERE ub.user_id = ? AND date(ub.earned_at) >= ${since}`
  ).bind(studentId).all();

  const { results: duelRows } = await env.DB.prepare(
    `SELECT date(finished_at) AS d, winner_id FROM duels
     WHERE (challenger_id = ? OR opponent_id = ?) AND status = 'finished' AND date(finished_at) >= ${since}`
  ).bind(studentId, studentId).all();

  const { results: purchaseRows } = await env.DB.prepare(
    `SELECT date(created_at) AS d FROM shop_purchases WHERE student_id = ? AND date(created_at) >= ${since}`
  ).bind(studentId).all();

  const byDay = new Map();
  const ensure = (d) => {
    if (!byDay.has(d)) byDay.set(d, { submissions: null, badges: [], duelWins: 0, duelLosses: 0, duelDraws: 0, purchases: 0 });
    return byDay.get(d);
  };

  for (const r of submissionRows) ensure(r.d).submissions = { n: r.n, avgScore: r.avgScore };
  for (const r of badgeRows) ensure(r.d).badges.push({ name: r.name, icon: r.icon });
  for (const r of duelRows) {
    const day = ensure(r.d);
    if (r.winner_id === studentId) day.duelWins++;
    else if (r.winner_id === null) day.duelDraws++;
    else day.duelLosses++;
  }
  for (const r of purchaseRows) ensure(r.d).purchases++;

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, day]) => ({ date, text: sentenceFor(day) }));
}

function sentenceFor(day) {
  const parts = [];
  if (day.badges.length) {
    parts.push(`نشان ${day.badges.map((b) => `${b.icon} «${b.name}»`).join('، ')} رو گرفت`);
  }
  if (day.submissions) {
    const hasScore = day.submissions.avgScore !== null && day.submissions.avgScore !== undefined;
    const avgTxt = hasScore ? ` (میانگین ٪${Math.round(day.submissions.avgScore)})` : '';
    parts.push(`${day.submissions.n} تکلیف فرستاد${avgTxt}`);
  }
  if (day.duelWins) parts.push(`${day.duelWins > 1 ? `${day.duelWins} نبرد ریاضی` : 'یه نبرد ریاضی'} رو برد ⚔️`);
  if (day.duelDraws) parts.push('یه نبرد ریاضی مساوی کرد');
  if (day.duelLosses) parts.push('توی نبرد ریاضی تلاش کرد');
  if (day.purchases) parts.push('از فروشگاه امتیاز خرید کرد 🛍️');

  if (!parts.length) return 'فعالیتی ثبت نشده.';
  return parts.join('، ') + '.';
}
