import { json, err } from '../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const student = data.user;
  if (student.role !== 'student') return err('forbidden', 403);

  const base = `
    SELECT d.id, d.status, d.question_count, d.winner_id, d.created_at, d.started_at, d.finished_at,
           d.challenger_id, d.opponent_id,
           c.full_name AS challenger_name, o.full_name AS opponent_name
    FROM duels d
    JOIN users c ON c.id = d.challenger_id
    JOIN users o ON o.id = d.opponent_id`;

  const { results: incoming } = await env.DB.prepare(
    `${base} WHERE d.opponent_id = ? AND d.status = 'pending' ORDER BY d.id DESC`
  ).bind(student.id).all();

  const { results: sent } = await env.DB.prepare(
    `${base} WHERE d.challenger_id = ? AND d.status = 'pending' ORDER BY d.id DESC`
  ).bind(student.id).all();

  const { results: active } = await env.DB.prepare(
    `${base} WHERE (d.challenger_id = ? OR d.opponent_id = ?) AND d.status = 'active' ORDER BY d.id DESC`
  ).bind(student.id, student.id).all();

  const { results: history } = await env.DB.prepare(
    `${base} WHERE (d.challenger_id = ? OR d.opponent_id = ?) AND d.status = 'finished' ORDER BY d.id DESC LIMIT 10`
  ).bind(student.id, student.id).all();

  const winsRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM duels WHERE winner_id = ? AND status = 'finished'`)
    .bind(student.id).first();

  const shape = (rows) => rows.map((d) => ({
    ...d,
    opponentName: d.challenger_id === student.id ? d.opponent_name : d.challenger_name,
  }));

  return json({
    incoming: shape(incoming),
    sent: shape(sent),
    active: shape(active),
    history: shape(history),
    wins: winsRow.n,
  });
}
