-- Migration 0004 — existing D1 ko company-schema ke base par laana
-- (users & projects me company ke columns add karna, BINA data delete kiye).
--
-- Ye sirf TAB chalao jab aapki D1 me pehle se data hai aur aap use
-- preserve karna chahte ho. FRESH database ke liye sirf schema.sql kaafi hai.
--
-- Run against the LIVE D1:
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0004_align_to_company_schema.sql
-- (use --local for the local dev DB)
--
-- NOTE: SQLite me ALTER ADD COLUMN ka default CONSTANT hona chahiye, isliye
-- timestamp columns DEFAULT NULL ke saath add kiye hai (datetime('now') yahan
-- allowed nahi hota). Naye rows me schema.sql wale defaults lagenge.

-- ----- users: company columns add karo (AI ke name/password_hash/role pehle se hai) -----
ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT NULL;        -- company FK roles(id)
ALTER TABLE users ADD COLUMN employee_id INTEGER DEFAULT NULL;    -- company FK employee(id)
ALTER TABLE users ADD COLUMN client_id INTEGER DEFAULT NULL;      -- company FK clients(id)
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT NULL;

-- ----- projects: company columns add karo (name pehle se hai) -----
ALTER TABLE projects ADD COLUMN client_id INTEGER DEFAULT NULL;   -- company FK clients(id)
ALTER TABLE projects ADD COLUMN description TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';     -- company enum('active','completed','on_hold')
ALTER TABLE projects ADD COLUMN updated_at TEXT DEFAULT NULL;

-- daily_status_entries pehle se company-aligned hai (task_name migration 0001 me).
-- Agar kisi purani DB me task_name nahi hai to pehle 0001 chalao.
