-- Migration 0002 — add the `ai_feedback` table.
--
-- Stores a snapshot of the last ~10 chat messages whenever a user taps "Report"
-- in the chatbot. This is the raw material for improving the AI: review where it
-- replied wrong, then turn those REAL failures into new test cases (tests/) or
-- prompt examples (ai/tools.js). That feedback loop IS how the assistant "learns"
-- — not by retraining the model, but by you curating its real mistakes.
--
-- SAFE: this ONLY creates a new table — it never touches existing data, so it
-- cannot break anything or lock anyone out.
--
-- Apply to the LIVE D1:
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0002_add_ai_feedback.sql
-- Apply to the LOCAL dev D1 (for `wrangler dev`):
--   npx wrangler d1 execute keyss-timesheet-db --local  --file=migrations/0002_add_ai_feedback.sql

CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    note TEXT DEFAULT NULL,            -- optional free-text note from the user
    selected_project TEXT DEFAULT NULL,
    messages TEXT NOT NULL,            -- JSON: the last N {role, content, context} turns
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback (employee_id, created_at);
