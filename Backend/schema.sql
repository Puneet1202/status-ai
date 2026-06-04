-- =========================================================================
-- KEYSS AI — D1 (Cloudflare SQLite) SCHEMA
-- 100% COMPANY-SCHEMA KE BASE PAR (statusk_test_2026 / MariaDB se aligned)
-- -------------------------------------------------------------------------
-- Rule jo follow kiya gaya hai:
--   • Jo tables company tak jaate hai (users, projects, daily_status_entries)
--     -> unke column NAAM / TYPE / ORDER company jaisa hi rakhe gaye hai.
--   • Company ke MariaDB types ko D1/SQLite me translate kiya gaya:
--        int        -> INTEGER
--        varchar/char/text/enum -> TEXT  (enum = TEXT + CHECK)
--        tinyint(1) -> INTEGER (0/1)
--        timestamp  -> TEXT DEFAULT (datetime('now'))
--   • AI ko jo EXTRA chahiye (login fields, task_name, project_tasks,
--     ai_feedback) -> vo company columns ke BAAD additive add kiya hai aur
--     "-- AI EXTRA" comment se mark kiya hai. Company website pe inka koi
--     asar nahi (alag database hai).
-- =========================================================================

-- Purani transactional tables saaf karo. NOTE: `users` ko DROP NAHI karte
-- taki existing login accounts safe rahe. (Structure badalna ho to migration
-- 0004 use karo — woh data preserve karke columns add karti hai.)
DROP TABLE IF EXISTS daily_status_entries;
DROP TABLE IF EXISTS project_tasks;
DROP TABLE IF EXISTS projects;
DROP TRIGGER IF EXISTS update_daily_status_entries_timestamp;

-- =========================================================================
-- 1. users   (company `users` ke base par + AI login columns)
-- =========================================================================
-- Company `users`: id, email, role_id, employee_id, client_id, is_active,
--                  created_at, updated_at  (login company me alag handle hota
--                  hai; name `employee` table se aata hai)
-- AI app ko apna login chahiye -> name / password_hash / role additive hai.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    role_id INTEGER DEFAULT NULL,            -- company: NOT NULL FK roles(id). D1 me roles table nahi, isliye nullable
    employee_id INTEGER DEFAULT NULL,        -- company: FK employee(id) — asli company employee se map karne ke liye
    client_id INTEGER DEFAULT NULL,          -- company: FK clients(id)
    is_active INTEGER NOT NULL DEFAULT 1,    -- company tinyint(1)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    -- ----- AI EXTRA (company users me nahi hote, AI ke login ke liye) -----
    name TEXT DEFAULT NULL,                  -- company me name `employee` table me hota hai
    password_hash TEXT DEFAULT NULL,         -- AI app khud bcrypt login karta hai
    role TEXT DEFAULT 'employee'             -- AI ka simple role (company me role_id se hota hai)
);

-- =========================================================================
-- 2. projects   (company `projects` ke base par)
-- =========================================================================
-- Company `projects`: id, client_id(NOT NULL), name, description,
--                     status enum('active','completed','on_hold'),
--                     created_at, updated_at
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER DEFAULT NULL,          -- company: NOT NULL FK clients(id). D1 me nullable taki AI sirf naam se project bana sake
    name TEXT NOT NULL UNIQUE,               -- UNIQUE = AI EXTRA (AI naam se dedup karta hai; company me unique nahi tha)
    description TEXT DEFAULT NULL,
    status TEXT CHECK(status IN ('active','completed','on_hold')) DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- =========================================================================
-- 3. project_tasks            -- AI EXTRA (company me ye table nahi hai)
-- =========================================================================
-- Har project ke predefined task names. Sirf AI ke kaam ke liye.
CREATE TABLE IF NOT EXISTS project_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, task_name)
);

-- =========================================================================
-- 4. daily_status_entries   (company `daily_status_entries` se 100% aligned)
-- =========================================================================
-- Yahi WAHI table hai jiska data office/company DB me jaata hai.
-- Company columns same order me. Sirf `task_name` AI EXTRA hai
-- (export karte waqt task_name aur duration_minutes mat bhejna — company
--  duration_minutes ko khud generate karti hai).
CREATE TABLE IF NOT EXISTS daily_status_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,            -- company: FK employee(id). D1 me users(id) AI ka stand-in hai
    project_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER,                -- company me GENERATED hota hai; D1 me app khud set karta hai
    task_description TEXT NOT NULL,
    task_name TEXT DEFAULT NULL,             -- AI EXTRA — user-selected predefined task(s), " | " se joined
    module_name TEXT DEFAULT NULL,           -- company column — AI auto-derived category (e.g. BUG_FIXING)
    is_email_sent TEXT CHECK(is_email_sent IN ('true','false')) DEFAULT 'false',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Company wala index (employee_id, entry_date)
CREATE INDEX IF NOT EXISTS idx_user_entry_date
ON daily_status_entries (employee_id, entry_date);

-- Company me `updated_at ON UPDATE current_timestamp()` — SQLite me trigger se
CREATE TRIGGER IF NOT EXISTS update_daily_status_entries_timestamp
AFTER UPDATE ON daily_status_entries
BEGIN
    UPDATE daily_status_entries
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- =========================================================================
-- 5. ai_feedback              -- AI EXTRA (company me ye table nahi hai)
-- =========================================================================
-- Jab user chatbot me "Report" dabata hai to recent chat ka snapshot, taki
-- galat AI reply review karke test-case/prompt example bana sake.
CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    note TEXT DEFAULT NULL,
    selected_project TEXT DEFAULT NULL,
    messages TEXT NOT NULL,                  -- JSON: last N {role, content, context} turns
    transcript TEXT DEFAULT NULL,            -- human-readable rendering of `messages`
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback (employee_id, created_at);

-- =========================================================================
-- FRESH SEED DATA (remote database me automatic load ke liye)
-- =========================================================================

-- Projects Insert (sirf naam — client_id nullable hai)
INSERT INTO projects (name) VALUES
('Status App'),
('AI Project'),
('Core Infra V2'),
('Internal Tools'),
('Project-X');

-- Dynamic Tasks Mapping
INSERT INTO project_tasks (project_id, task_name) VALUES
-- Status App (ID: 1)
(1, 'UI Layout Refactoring'),
(1, 'State Bug Fixes'),
(1, 'Popup Dropdown Integration'),

-- AI Project (ID: 2)
(2, 'Prompt Tuning'),
(2, 'Embedding Pipeline Setup'),
(2, 'Model Output Extraction'),

-- Core Infra V2 (ID: 3)
(3, 'Database Migration Script'),
(3, 'Auth JWT Token Validation');
