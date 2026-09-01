import { json, err } from '../_lib/http.js';
import { findItem } from '../_lib/shop.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  const item = body?.itemCode ? findItem(body.itemCode) : null;
  if (!item) return err('itemCode is not valid');

  if (item.type === 'skip_card') {
    const school = await env.DB.prepare('SELECT skip_cards_enabled FROM schools WHERE id = ?').bind(student.school_id).first();
    if (!school?.skip_cards_enabled) return err('skip cards are disabled for this school', 403);
  }

  if (item.type === 'accessory') {
    const already = await env.DB.prepare(
      `SELECT id FROM shop_purchases WHERE student_id = ? AND item_type = 'accessory' AND item_code = ?`
    ).bind(student.id, item.code).first();
    if (already) return err('this accessory is already owned', 409);
  }

  // قیمت همیشه از کاتالوگ سرور خونده می‌شه، هرگز از کلاینت — تراکنش اتمی با یک شرط روی موجودی سکه.
  const user = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(student.id).first();
  if (user.coins < item.cost) return err('not enough coins', 402);

  const deduct = await env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?')
    .bind(item.cost, student.id, item.cost).run();
  if (!deduct.meta || deduct.meta.changes === 0) return err('not enough coins', 402);

  await env.DB.prepare('INSERT INTO shop_purchases (student_id, item_code, item_type) VALUES (?, ?, ?)')
    .bind(student.id, item.code, item.type).run();

  const updated = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(student.id).first();
  return json({ ok: true, coins: updated.coins });
}
