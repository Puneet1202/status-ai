-- Migration: Add ai_interaction_logs table for analytics
-- Run this in Cloudflare D1:
--   wrangler d1 execute <your-db-name> --file=migrations/0002_add_analytics.sql

CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  intent      TEXT NOT NULL,
  -- add | get | update | delete | smalltalk | conversational | confirm_pending | unknown
  tool_called TEXT,
  -- add_timesheet_entries | get_timesheet_logs | update_timesheet | delete_timesheet | NULL
  success     INTEGER NOT NULL DEFAULT 1,
  -- 1 = success / reply returned, 0 = failed / no-action
  msg_length  INTEGER,
  -- character count of user's message (NO message text stored — privacy)
  lang_hint   TEXT,
  -- 'en' | 'hi' | 'mixed'
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Index for fast date-range queries (admin analytics dashboard)
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_date
  ON ai_interaction_logs (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_logs_intent_date
  ON ai_interaction_logs (intent, created_at);
