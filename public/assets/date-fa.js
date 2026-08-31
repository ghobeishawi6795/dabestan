// تبدیل تاریخ میلادی به شمسی — الگوریتم استاندارد (بدون هیچ کتابخانهٔ بیرونی).
// دقیق برای بازهٔ سال‌های ۱۱۷۸ تا ۱۶۳۳ هجری شمسی (یعنی همهٔ تاریخ‌های امروز و آینده‌ی نزدیک).
(function (global) {
  const JMONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const G_D_M = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  function toFaDigits(input) {
    return String(input).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  function gregorianToJalali(gy, gm, gd) {
    let jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + G_D_M[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let jm, jd;
    if (days < 186) {
      jm = 1 + Math.floor(days / 31);
      jd = 1 + (days % 31);
    } else {
      jm = 7 + Math.floor((days - 186) / 30);
      jd = 1 + ((days - 186) % 30);
    }
    return [jy, jm, jd];
  }

  // مقادیر ذخیره‌شده در دیتابیس به دو شکل‌اند: 'YYYY-MM-DD' (فقط تاریخ، مثل موعد تحویل) یا
  // 'YYYY-MM-DD HH:MM:SS'/ISO با Z (زمان دقیق UTC، مثل created_at). این تابع هردو رو درست می‌خونه.
  function parseDbDate(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d); // تاریخ خام، بدون منطقهٔ زمانی — از پرش یک‌روزه جلوگیری می‌کنه
    }
    s = s.replace(' ', 'T');
    if (!/Z$|[+-]\d\d:\d\d$/.test(s)) s += 'Z';
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatJalali(raw, opts) {
    const d = parseDbDate(raw);
    if (!d) return '—';
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    let out = `${toFaDigits(jd)} ${JMONTHS[jm - 1]} ${toFaDigits(jy)}`;
    if (opts && opts.time) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      out += `، ساعت ${toFaDigits(hh)}:${toFaDigits(mm)}`;
    }
    return out;
  }

  global.toFaDigits = toFaDigits;
  global.formatJalali = formatJalali;
  global.gregorianToJalali = gregorianToJalali;
})(window);
