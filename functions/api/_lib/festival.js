// بازه‌های جشنواره‌ها — برای اضافه‌کردن جشنوارهٔ جدید فقط یه ردیف به این آرایه اضافه کن.
const FESTIVALS = [
  { code: 'mehregan_1405', name: 'جشنوارهٔ مهر', icon: '🍂', start: '2026-09-02', end: '2026-10-17' },
  { code: 'yalda_1405', name: 'جشنوارهٔ یلدا', icon: '🍉', start: '2026-12-11', end: '2026-12-22' },
  { code: 'noruz_1406', name: 'جشنوارهٔ نوروز', icon: '🌸', start: '2027-03-12', end: '2027-04-02' },
];

export function getActiveFestival(now = new Date()) {
  const todayStr = now.toISOString().slice(0, 10);
  return FESTIVALS.find((f) => todayStr >= f.start && todayStr <= f.end) || null;
}

export function getFestivalByCode(code) {
  return FESTIVALS.find((f) => f.code === code) || null;
}
