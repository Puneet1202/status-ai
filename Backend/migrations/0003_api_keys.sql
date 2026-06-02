-- Migration: Multi-tenant API Key system
-- Run: wrangler d1 execute <db-name> --file=migrations/0003_api_keys.sql
--
-- This enables:
--   1. Companies to connect your AI without putting any code on your server
--   2. Per-company rate limiting
--   3. Admin visibility into which company uses how much

-- ── Companies table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'free',
  -- free | pro | enterprise
  contact_email TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  is_active    INTEGER NOT NULL DEFAULT 1
);

-- ── API Keys table ────────────────────────────────────────────────────────
-- The actual key is NEVER stored. Only a SHA-256 hex hash is stored.
-- The prefix (first 12 chars) is stored for UI display ("keyss_live_ab...")
CREATE TABLE IF NOT EXISTS api_keys (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL UNIQUE,
  -- SHA-256(actual_key) in hex
  key_prefix      TEXT NOT NULL,
  -- e.g. "keyss_live_a" — shown in dashboard, not secret
  name            TEXT DEFAULT 'Default Key',
  -- "Production", "Staging", etc.
  plan            TEXT NOT NULL DEFAULT 'free',
  -- free(100/day) | pro(5000/day) | enterprise(unlimited)
  requests_today  INTEGER NOT NULL DEFAULT 0,
  last_reset_date TEXT NOT NULL DEFAULT (date('now')),
  -- reset requests_today daily
  last_used_at    TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash    ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys (company_id);

-- ── Seed: one demo company for testing ───────────────────────────────────
-- Key: keyss_live_DEMO00000000  (hash of this literal string for local test)
-- DO NOT use in production — replace with real keys via admin endpoint
INSERT OR IGNORE INTO companies (id, name, plan, contact_email)
VALUES (1, 'Demo Company', 'pro', 'demo@keyss.io');
