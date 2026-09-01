import { json, err } from '../_lib/http.js';
import { SHOP_ITEMS } from '../_lib/shop.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const user = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(student.id).first();
  const school = await env.DB.prepare('SELECT skip_cards_enabled FROM schools WHERE id = ?').bind(student.school_id).first();

  const { results: owned } = await env.DB.prepare(
    `SELECT item_code FROM shop_purchases WHERE student_id = ? AND item_type = 'accessory'`
  ).bind(student.id).all();
  const ownedAccessories = new Set(owned.map((r) => r.item_code));

  const skipCreditsRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM shop_purchases WHERE student_id = ? AND item_type = 'skip_card' AND used_at IS NULL`
  ).bind(student.id).first();

  const items = SHOP_ITEMS
    .filter((i) => i.type !== 'skip_card' || school?.skip_cards_enabled)
    .map((i) => ({ ...i, owned: i.type === 'accessory' ? ownedAccessories.has(i.code) : undefined }));

  return json({ items, coins: user.coins, skipCredits: skipCreditsRow.n });
}
