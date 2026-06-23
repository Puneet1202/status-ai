-- Migration 0006 — add the `ai_chat_logs` table.
--
-- Purpose: har AI chat turn ko save karna taaki baad me per-user PERSONALIZATION
-- (user ke pattern/style ko samajhna) aur future fine-tune ke liye training data
-- mil sake. `ai_feedback` (sirf "Report" button, employee_id pe) se ALAG — ye HAR
-- turn save karta hai aur USER_ID (users.id) pe key hota hai (jaisa decide kiya).
--
-- Ek row = ek poora exchange (user_message + ai_reply) = ek training example.
--
-- SAFE: sirf naya table + index banata hai — koi existing data touch NAHI hota.
-- Logging khud handler me fire-and-forget hai → ye table na ho to bhi chat chalti hai.
--
-- Apply to LOCAL dev D1:
--   npx wrangler d1 execute keyss-timesheet-db --local  --file=migrations/0006_ai_chat_logs.sql
-- Apply to LIVE / remote D1 (prod data import ke baad, ek baar):
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0006_ai_chat_logs.sql

CREATE TABLE IF NOT EXISTS ai_chat_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,          -- users.id (employee_id NAHI)
    session_id       TEXT    DEFAULT NULL,        -- ek baithak group karne ko (optional)
    user_message     TEXT    NOT NULL,            -- user ne jo type kiya
    ai_reply         TEXT    DEFAULT NULL,         -- AI ka jawab
    intent           TEXT    DEFAULT NULL,         -- routed action: apply_leave / get_timesheet …
    route            TEXT    DEFAULT NULL,         -- 'deterministic' (0-token) | 'brain' (LLM)
    tool_name        TEXT    DEFAULT NULL,         -- dispatch hua tool (agar koi)
    selected_project TEXT    DEFAULT NULL,         -- pill context (agar tha)
    tokens           INTEGER DEFAULT 0,            -- us turn ke tokens (trace se)
    created_at       TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user ON ai_chat_logs (user_id, created_at);
