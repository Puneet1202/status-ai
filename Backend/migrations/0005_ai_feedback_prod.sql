-- Migration 0005 — add the `ai_feedback` table for the prod.db (D1) schema.
--
-- The production database (keyss-status.prod.db) does NOT contain ai_feedback,
-- but the chatbot's "Report" button writes to it. This creates it, aligned to
-- the prod schema: the FK points at employee(id) (NOT users.id), because every
-- other timesheet/feedback row keys off the employee record.
--
-- SAFE: only CREATEs a new table + index — never touches existing data.
--
-- Apply to LOCAL dev D1:
--   npx wrangler d1 execute keyss-timesheet-db --local  --file=migrations/0005_ai_feedback_prod.sql
-- Apply to LIVE / remote D1 (do this once, after the prod data import):
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0005_ai_feedback_prod.sql

CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    note TEXT DEFAULT NULL,             -- optional free-text note from the user
    selected_project TEXT DEFAULT NULL,
    messages TEXT NOT NULL,             -- JSON: last N {role, content, context} turns
    transcript TEXT DEFAULT NULL,       -- human-readable one-line-per-turn copy
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_employee ON ai_feedback (employee_id, created_at);
