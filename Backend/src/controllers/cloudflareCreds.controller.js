// FILE: backend/src/controllers/cloudflareCreds.controller.js
// KAAM: PER-USER Cloudflare connect/status endpoints.
//
//   POST /ai/connect-cloudflare  { token }
//     1. token se GET /user        → CF account ka email (verify token + perm)
//     2. email DOMAIN check         → office/company email hi allowed
//     3. GET /accounts              → account_id AUTO (user ko paste nahi karna)
//     4. GET /accounts/:id/ai/models/search → Workers AI perm verify (0 cost ping)
//     5. token ENCRYPT karke user_ai_credentials me UPSERT (UNIQUE user_id)
//
//   GET /ai/cf-status            → { connected, email? }  (frontend decide kare
//                                   connect-screen dikhani ya normal chat)
//
// Security: self-only (c.get('user').id). Token kabhi response me wapas NAHI jaata.

import { cfFetch } from '../ai/userCfCreds.js';
import { encryptToken } from '../utils/cryptoToken.js';

// Email enforcement: CF account ka email allowed hai ya nahi.
//  - DEFAULT (env blank): EXACT match — CF email == website login email. Fully
//    dynamic, koi env nahi chahiye (chatbot + website dono same office email).
//  - Agar `COMPANY_EMAIL_DOMAIN` set ho (comma-separated): sirf DOMAIN match
//    (loose) — same domain ka koi bhi email chalega.
// Return: { ok, message }.
function checkCfEmail(c, loginEmail, cfEmail) {
  const envDomains = (c.env.COMPANY_EMAIL_DOMAIN || '').trim();
  if (envDomains) {
    const domains = envDomains.split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    const emailDomain = String(cfEmail).split('@')[1] || '';
    if (domains.length && !domains.includes(emailDomain)) {
      return { ok: false, message: `Please use your office Cloudflare account (email must be @${domains[0]}).` };
    }
    return { ok: true };
  }
  // Default: exact match to the email the user logs into the app with.
  if (String(loginEmail || '').toLowerCase() !== String(cfEmail || '').toLowerCase()) {
    return { ok: false, message: `Your Cloudflare account email must be the same as your login email (${loginEmail}).` };
  }
  return { ok: true };
}

export const connectCloudflare = async (c) => {
  try {
    const user = c.get('user');
    const encKey = c.env.ENCRYPTION_KEY;
    if (!encKey) {
      return c.json({ success: false, message: 'Server is not configured for connecting AI (ENCRYPTION_KEY missing).' }, 500);
    }

    const body = await c.req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    // Account id user bhi de sakta (dashboard URL me dikhti). Auto-fetch fail ho
    // (Workers AI + User Details token /accounts list nahi karne deta) to ye use hoti.
    const bodyAccountId = String(body.accountId || '').trim();
    if (!token) {
      return c.json({ success: false, message: 'Please paste your Cloudflare API token.' }, 400);
    }

    // 1. Token valid? + email (needs "User Details: Read" permission).
    const userRes = await cfFetch('/user', token);
    if (!userRes.ok) {
      const why = userRes.status === 403
        ? 'Token is missing the "User Details: Read" permission.'
        : 'Invalid Cloudflare API token.';
      return c.json({ success: false, message: why }, 400);
    }
    const cfEmail = String(userRes.json?.result?.email || '').toLowerCase();

    // 2. Company email enforce (default: exact match to login email).
    const emailCheck = checkCfEmail(c, user.email, cfEmail);
    if (!emailCheck.ok) {
      return c.json({ success: false, message: emailCheck.message }, 400);
    }

    // 3. Account id: pehle AUTO-fetch (GET /accounts). Kuch token-config (specific
    //    account scope) account dete hain → user ko sirf token paste karna pada.
    //    Jo nahi dete (e.g. "All accounts" wildcard) → frontend ko `needAccountId`
    //    bhejo → wo TABHI account-id field dikhata hai (warna sirf token field).
    const acctRes = await cfFetch('/accounts', token);
    let accountId = (acctRes.ok && acctRes.json?.result?.[0]?.id) || '';
    // Workers-AI tokens return an EMPTY /accounts list even when scoped to one
    // account. With "User → Memberships → Read" added, /memberships DOES return
    // the account → use it so the user only pastes the token (no Account ID field).
    if (!accountId) {
      const memRes = await cfFetch('/memberships', token);
      accountId = (memRes.ok && memRes.json?.result?.[0]?.account?.id) || '';
    }
    // Last resort: user-pasted Account ID (token without Memberships perm).
    accountId = accountId || bodyAccountId;
    if (!accountId) {
      return c.json({
        success: false,
        needAccountId: true,
        message: "Almost there! We couldn't detect your Account ID automatically — please paste it below (copy it from your Cloudflare dashboard URL).",
      }, 200);
    }

    // 4. Workers AI permission + account id verify (0-cost — sirf models list, koi
    //    model run nahi). Galat account id ya missing AI perm → yahin pakda jaata.
    const aiRes = await cfFetch(`/accounts/${accountId}/ai/models/search?per_page=1`, token);
    if (!aiRes.ok) {
      return c.json({ success: false, message: 'Could not verify Workers AI access. Check your Account ID and that the token has "Workers AI: Read".' }, 400);
    }

    // 5. Encrypt + UPSERT (UNIQUE user_id → dobara connect = replace).
    const enc = await encryptToken(token, encKey);
    await c.env.DB
      .prepare(
        `INSERT INTO user_ai_credentials (user_id, employee_id, account_id, api_token, cf_email, status, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
            employee_id = excluded.employee_id,
            account_id  = excluded.account_id,
            api_token   = excluded.api_token,
            cf_email    = excluded.cf_email,
            status      = 'active',
            updated_at  = datetime('now')`
      )
      .bind(user.id, user.employee_id ?? null, accountId, enc, cfEmail)
      .run();

    return c.json({ success: true, connected: true, email: cfEmail }, 200);
  } catch (error) {
    console.error('[connectCloudflare Error]:', error);
    return c.json({ success: false, message: 'Could not connect your Cloudflare account.' }, 500);
  }
};

export const cfStatus = async (c) => {
  try {
    const user = c.get('user');
    const row = await c.env.DB
      .prepare('SELECT cf_email, status FROM user_ai_credentials WHERE user_id = ?')
      .bind(user.id)
      .first();
    const connected = !!row && row.status === 'active';
    // `required` = kya connect karna ZAROORI hai (AI_REQUIRE_USER_CF). Frontend
    // overlay sirf (!connected && required) pe dikhata hai → flag off hone par
    // bina-connect user bhi shared AI se chat kar sake (no regression).
    const required = c.env.AI_REQUIRE_USER_CF === '1';
    return c.json({ success: true, connected, required, email: connected ? row.cf_email : null }, 200);
  } catch (error) {
    console.error('[cfStatus Error]:', error);
    return c.json({ success: false, connected: false }, 200);
  }
};
