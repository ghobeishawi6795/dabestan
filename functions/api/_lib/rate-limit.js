const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;

async function keyHash(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function rateLimit(env, key, maxAttempts = MAX_ATTEMPTS) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / WINDOW_SECONDS);
  const hashedKey = await keyHash(`${key}:${bucket}`);

  await env.DB.prepare(`
    INSERT INTO rate_limits (key_hash, bucket, attempts)
    VALUES (?, ?, 1)
    ON CONFLICT(key_hash, bucket)
    DO UPDATE SET attempts = attempts + 1
  `).bind(hashedKey, bucket).run();

  const row = await env.DB.prepare(`
    SELECT attempts
    FROM rate_limits
    WHERE key_hash = ?
      AND bucket = ?
    LIMIT 1
  `).bind(hashedKey, bucket).first();

  const attempts = Number(row?.attempts || 0);
  const retryAfter = Math.max(1, (bucket + 1) * WINDOW_SECONDS - now);

  return {
    allowed: attempts <= maxAttempts,
    retryAfter
  };
}
