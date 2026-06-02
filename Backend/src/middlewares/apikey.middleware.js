// FILE: backend/src/middlewares/apikey.middleware.js
// =========================================================================
// API KEY AUTHENTICATION MIDDLEWARE
// =========================================================================
// Used by the PUBLIC API routes (/v1/*).
// Any company's website sends:  X-API-Key: keyss_live_abc123
//
// What this does:
//   1. Hash the incoming key with SHA-256
//   2. Look it up in the api_keys table
//   3. Check is_active + company's is_active
//   4. Check + increment daily rate limit (auto-reset at midnight UTC)
//   5. Set ctx variables: company_id, api_key_id, plan
//
// Privacy: the raw key is NEVER logged or stored. Only the hash.
// =========================================================================

import { RATE_LIMIT_FREE, RATE_LIMIT_PRO, RATE_LIMIT_ENTERPRISE } from '../ai/ai-config.js';

const PLAN_LIMITS = {
  free: RATE_LIMIT_FREE,
  pro: RATE_LIMIT_PRO,
  enterprise: RATE_LIMIT_ENTERPRISE,
};

// SHA-256 hash using Web Crypto API (available in CF Workers + Node 18+)
async function sha256hex(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const apiKeyMiddleware = async (c, next) => {
  const rawKey = c.req.header('X-API-Key') || c.req.header('x-api-key');

  if (!rawKey || !rawKey.startsWith('keyss_')) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing or invalid API key. Pass X-API-Key header.',
        docs: 'https://docs.keyss.io/authentication',
      },
      401
    );
  }

  const db = c.env?.DB;
  if (!db) return c.json({ error: 'Database unavailable' }, 503);

  const keyHash = await sha256hex(rawKey);

  // Single JOIN query — avoids N+1
  const record = await db
    .prepare(
      `SELECT 
        k.id, k.company_id, k.plan, k.is_active AS key_active,
        k.requests_today, k.last_reset_date,
        c.is_active AS company_active, c.name AS company_name
       FROM api_keys k
       JOIN companies c ON c.id = k.company_id
       WHERE k.key_hash = ?`
    )
    .bind(keyHash)
    .first();

  if (!record) {
    return c.json({ error: 'Invalid API key', message: 'Key not found.' }, 401);
  }
  if (!record.key_active || !record.company_active) {
    return c.json({ error: 'API key disabled', message: 'This key has been deactivated.' }, 403);
  }

  // ── Daily rate-limit reset ────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10); // UTC date
  if (record.last_reset_date !== today) {
    await db
      .prepare(`UPDATE api_keys SET requests_today = 0, last_reset_date = ? WHERE id = ?`)
      .bind(today, record.id)
      .run();
    record.requests_today = 0;
  }

  // ── Rate limit check ──────────────────────────────────────────────────
  const limit = PLAN_LIMITS[record.plan] ?? PLAN_LIMITS.free;
  if (record.requests_today >= limit) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        message: `Your plan allows ${limit} requests/day. Resets at midnight UTC.`,
        plan: record.plan,
        limit,
        used: record.requests_today,
        upgrade: 'Contact keyss.io to upgrade your plan.',
      },
      429
    );
  }

  // ── Increment usage + update last_used_at (fire-and-forget) ──────────
  db.prepare(
    `UPDATE api_keys 
     SET requests_today = requests_today + 1, last_used_at = datetime('now')
     WHERE id = ?`
  )
    .bind(record.id)
    .run()
    .catch((err) => console.warn('[ApiKey] Usage update failed (non-fatal):', err?.message));

  // ── Attach context for downstream handlers ────────────────────────────
  c.set('company_id', record.company_id);
  c.set('company_name', record.company_name);
  c.set('api_key_id', record.id);
  c.set('api_plan', record.plan);
  c.set('rate_remaining', limit - record.requests_today - 1);

  // Also set a minimal 'user' object so aiChatHandler still works
  // (it reads c.get('user').id for analytics logging)
  c.set('user', { id: `company_${record.company_id}`, role: 'api', company_id: record.company_id });

  // Pass rate limit info in response headers (like GitHub API)
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(Math.max(0, limit - record.requests_today - 1)));
  c.header('X-RateLimit-Reset', 'midnight UTC');

  await next();
};
