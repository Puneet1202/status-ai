// FILE: backend/src/ai/userCfCreds.js
// KAAM: PER-USER Cloudflare creds ka DB layer + helpers.
//   - getUserCfCreds(): DB se ek user ke creds nikaal ke token DECRYPT karke deta.
//   - makeUserAi(): un creds se REST provider (env.AI jaisा) banata.
//   - cfFetch(): Cloudflare API call helper (token se).
// Connect/verify controller isi ko use karta hai; aiChatHandler bhi (Step 5).

import { decryptToken } from '../utils/cryptoToken.js';
import { makeWorkersAI } from './providers/cloudflareRest.js';

const CF_API = 'https://api.cloudflare.com/client/v4';

// Cloudflare API call (user ke token se). { ok, status, json } deta.
export async function cfFetch(path, token) {
  const resp = await fetch(`${CF_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  let json = null;
  try { json = await resp.json(); } catch { /* non-JSON */ }
  return { ok: resp.ok && json?.success !== false, status: resp.status, json };
}

// DB se ek user ke saved creds → { accountId, token (decrypted), email } | null.
// Token decrypt fail (galat ENCRYPTION_KEY / corrupt) → null (feature off, chat safe).
export async function getUserCfCreds(db, userId, encKey) {
  if (!db || !userId) return null;
  const row = await db
    .prepare('SELECT account_id, api_token, cf_email, status FROM user_ai_credentials WHERE user_id = ?')
    .bind(userId)
    .first();
  if (!row || row.status !== 'active') return null;
  try {
    const token = await decryptToken(row.api_token, encKey);
    return { accountId: row.account_id, token, email: row.cf_email };
  } catch {
    return null;
  }
}

// Creds → REST AI provider (same shape as env.AI binding).
export function makeUserAi(creds) {
  return makeWorkersAI({ accountId: creds.accountId, apiToken: creds.token });
}
