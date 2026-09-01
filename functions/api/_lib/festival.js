// بازهٔ جشنوارهٔ مهر — ۲۰ شهریور تا ۲۵ مهر ۱۴۰۵ (معادل میلادی زیر).
// اگر جشنوارهٔ بعدی/دیگه‌ای اضافه شد، به همین آرایه اضافه کن؛ isFestivalActive همیشه اولین موردِ فعال رو برمی‌گردونه.
const FESTIVALS = [
  { code: 'mehregan_1405', name: 'جشنوارهٔ مهر', icon: '🍂', start: '2026-09-11', end: '2026-10-17' },
];

export function getActiveFestival(now = new Date()) {
  const todayStr = now.toISOString().slice(0, 10);
  return FESTIVALS.find((f) => todayStr >= f.start && todayStr <= f.end) || null;
}
