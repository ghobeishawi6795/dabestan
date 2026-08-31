// فایل عکس رو می‌گیره، روی canvas کوچیک و فشرده می‌کنه، و data URL برمی‌گردونه —
// اینطوری قبل از ارسال به سرور حجمش خیلی کمه (بدون R2، مستقیم توی D1 ذخیره می‌شه).
async function compressImageFile(file, maxSize, quality) {
  maxSize = maxSize || 256;
  quality = quality || 0.72;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
