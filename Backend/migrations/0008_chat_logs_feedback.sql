-- Migration 0008 — `ai_chat_logs` ko "usable" banane ke liye feedback columns.
--
-- Bina label ke raw chat se train karna kamzor hai. Ye columns har turn ko
-- 👍/👎 (ya correct/wrong) flag dete hain taaki baad me ACHHE examples filter
-- karke train/improve kar sako.
--
--   feedback:       1 = 👍 (achha jawab), -1 = 👎 (galat), NULL = koi rating nahi
--   feedback_note:  optional chhota note ("date galat thi", etc.)
--
-- SAFE: sirf 2 naye nullable column + index — existing data/columns untouched.
--
-- Apply:
--   npx wrangler d1 execute keyss-timesheet-db --local  --file=migrations/0008_chat_logs_feedback.sql
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0008_chat_logs_feedback.sql

ALTER TABLE ai_chat_logs ADD COLUMN feedback INTEGER DEFAULT NULL;
ALTER TABLE ai_chat_logs ADD COLUMN feedback_note TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_feedback ON ai_chat_logs (feedback);
