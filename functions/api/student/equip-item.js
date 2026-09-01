import { json, err } from '../_lib/http.js';
import { findItem } from '../_lib/shop.js';

export async function onRequestPost({ request, env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const body = await request.json().catch(() => null);
  const item = body?.itemCode ? findItem(body.itemCode) : null;
  if (!item || item.type !== 'accessory') return err('itemCode is not a valid accessory');
  if (typeof body.equip !== 'boolean') return err('equip must be true or false');

  const owned = await env.DB.prepare(
    `SELECT id FROM shop_purchases WHERE student_id = ? AND item_type = 'accessory' AND item_code = ?`
  ).bind(student.id, item.code).first();
  if (!owned) return err('this accessory is not owned', 403);

  const pet = await env.DB.prepare('SELECT accessories FROM pets WHERE student_id = ?').bind(student.id).first();
  if (!pet) return err('no pet chosen yet', 404);

  let accessories = JSON.parse(pet.accessories || '[]');
  if (body.equip) {
    if (!accessories.includes(item.code)) accessories.push(item.code);
  } else {
    accessories = accessories.filter((c) => c !== item.code);
  }

  await env.DB.prepare('UPDATE pets SET accessories = ? WHERE student_id = ?')
    .bind(JSON.stringify(accessories), student.id).run();

  return json({ ok: true, accessories });
}
