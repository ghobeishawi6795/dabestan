// Auth helpers: PBKDF2 password hashing + HMAC-signed session tokens.
// Design choices carried over from lessons learned reviewing earlier projects:
//  - AUTH_SECRET is NEVER hardcoded or given a dev fallback — missing/weak secret throws (fails closed).
//  - is_active is rechecked from the DB on every request, not just trusted from the token payload.
//  - every DB-touching helper here takes school_id explicitly; callers must always scope by it.

const enc = new TextEncoder();

export function getSecret(env) {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is missing or too short — set it with `wrangler pages secret put AUTH_SECRET`.');
  }
  return secret;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return toHex(bits) === hash;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}

// Session token: base64url(payload).hexSignature — payload carries only non-sensitive routing info.
// SESSION_TTL_SECONDS keeps tokens short-lived; re-login is cheap for elementary students on shared devices.
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export async function createSessionToken(env, { userId, schoolId, role }) {
  const secret = getSecret(env);
  const payload = JSON.stringify({ uid: userId, sid: schoolId, role, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const payloadB64 = btoa(payload);
  const sig = await hmac(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySessionToken(env, token) {
  if (!token || !token.includes('.')) return null;
  const secret = getSecret(env);
  const [payloadB64, sig] = token.split('.');
  const expected = await hmac(secret, payloadB64);
  if (expected !== sig) return null;
  let payload;
  try {
    payload = JSON.parse(atob(payloadB64));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload; // { uid, sid, role, exp }
}

// Re-checks is_active + role/school straight from D1 — never trusts the token payload alone
// for anything authorization-sensitive (learned from earlier project's dead is_active check).
export async function getAuthUser(env, token) {
  const payload = await verifySessionToken(env, token);
  if (!payload) return null;
  const row = await env.DB.prepare(
    'SELECT id, school_id, role, username, full_name, class_id, is_active, is_super FROM users WHERE id = ?'
  ).bind(payload.uid).first();
  if (!row || !row.is_active) return null;
  if (row.school_id !== payload.sid || row.role !== payload.role) return null;
  return row;
}
