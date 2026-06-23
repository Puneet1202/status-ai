-- Migration 0007 — add a convenience `employee_id` column to `ai_chat_logs`.
--
-- LOGIC user_id pe hi rehta hai (jaisa decide hua) — ye sirf ek EXTRA column hai
-- taaki search/filter employee_id se bhi ho sake (jo yaad rehta hai). Nullable:
-- jis user ka employee record na ho uske liye NULL (chat phir bhi save hoti hai).
--
-- SAFE: sirf ek naya nullable column + index — existing data/columns untouched.
--
-- Apply:
--   npx wrangler d1 execute keyss-timesheet-db --local  --file=migrations/0007_chat_logs_employee_id.sql
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0007_chat_logs_employee_id.sql

ALTER TABLE ai_chat_logs ADD COLUMN employee_id INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_employee ON ai_chat_logs (employee_id, created_at);
