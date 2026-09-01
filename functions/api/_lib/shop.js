// کاتالوگ فروشگاه امتیاز + گونه‌های حیوان خانگی — منبع واحد سمت سرور (کلاینت هرگز قیمت رو تعیین نمی‌کنه).

export const PET_SPECIES = [
  { code: 'cat', name: 'گربه', icon: '🐱' },
  { code: 'rabbit', name: 'خرگوش', icon: '🐰' },
  { code: 'bird', name: 'جوجه‌تیغی', icon: '🐦' },
];

// item_type: 'accessory' یا 'skip_card'
export const SHOP_ITEMS = [
  { code: 'hat_party', name: 'کلاه مهمونی', icon: '🎉', type: 'accessory', cost: 30 },
  { code: 'bow_tie', name: 'پاپیون', icon: '🎀', type: 'accessory', cost: 25 },
  { code: 'glasses', name: 'عینک باحال', icon: '🕶️', type: 'accessory', cost: 40 },
  { code: 'crown', name: 'تاج', icon: '👑', type: 'accessory', cost: 60 },
  { code: 'scarf', name: 'شال گردن', icon: '🧣', type: 'accessory', cost: 25 },
  { code: 'skip_card', name: 'کارت معافیت از تکلیف', icon: '🎫', type: 'skip_card', cost: 80 },
];

export function findItem(code) {
  return SHOP_ITEMS.find((i) => i.code === code) || null;
}

export function isValidSpecies(code) {
  return PET_SPECIES.some((p) => p.code === code);
}
