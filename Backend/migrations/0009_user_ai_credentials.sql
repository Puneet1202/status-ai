-- Migration 0009 — add the `user_ai_credentials` table.
--
-- Purpose: PER-USER Cloudflare creds. Har user apna khud ka free Cloudflare
-- account (office email se) connect karega → apni AI quota use karega, shared
-- company limit nahi. Ek row = ek user ke creds.
--
-- account_id  : Cloudflare account id (app khud GET /accounts se nikaalti — user
--               ko paste nahi karna).
-- api_token   : ENCRYPTED token (kabhi plain nahi; encrypt key = ENCRYPTION_KEY
--               secret). Frontend ko wapas kabhi nahi bheja jaata.
-- cf_email    : token ke account ka email (GET /user se) — company-email enforce
--               karne ke liye verify + record.
-- status      : 'active' | 'invalid' (token fail hone pe mark kar sakte hain).
--
-- one-per-user: UNIQUE(user_id) → dobara connect = UPSERT (purana replace).
--
-- SAFE: sirf naya table + index — koi existing data touch NAHI. Table na ho to
-- feature off (handler shared/stub fallback) — chat phir bhi chalti hai.
--
-- Apply to LOCAL dev D1:
--   npx wrangler d1 execute keyss-timesheet-db --local  --file=migrations/0009_user_ai_credentials.sql
-- Apply to LIVE / remote D1 (ek baar):
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0009_user_ai_credentials.sql

CREATE TABLE IF NOT EXISTS user_ai_credentials (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,                    -- users.id (logic isi pe)
    employee_id INTEGER DEFAULT NULL,                -- EXTRA filter column (search easy) — jaise 0007 chat-logs
    account_id  TEXT    NOT NULL,                    -- CF account id (auto-fetched)
    api_token   TEXT    NOT NULL,                    -- ENCRYPTED CF API token
    cf_email    TEXT    DEFAULT NULL,                -- token account ka email (verify)
    status      TEXT    DEFAULT 'active',            -- 'active' | 'invalid'
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now')),
    UNIQUE (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_ai_creds_user ON user_ai_credentials (user_id);
