-- =========================================================================
-- D1 CLOUD REMOVED/FRESH CONFIGURATION FOR PUNEET
-- =========================================================================

-- Purani transactional tables ko saaf karo (Users ko nahi chhedna hai)
DROP TABLE IF EXISTS daily_status_entries;
DROP TABLE IF EXISTS project_tasks; 
DROP TABLE IF EXISTS projects;
DROP TRIGGER IF EXISTS update_daily_status_entries_timestamp;

-- 1. Users Table (Agar drop nahi hui toh purana data safe rahega)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ⭐ NEW METADATA TABLE: Isme saare dynamic tasks rahenge
CREATE TABLE IF NOT EXISTS project_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, task_name)
);

-- 3. Main Timesheet Table (Company schema se 100% synchronized)
CREATE TABLE IF NOT EXISTS daily_status_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER,
    task_description TEXT NOT NULL,
    task_name TEXT DEFAULT NULL,   -- ⭐ User-selected predefined project task(s) — joined with " | "
    module_name TEXT DEFAULT NULL, -- AI auto-derived work category (e.g. BUG_FIXING)
    is_email_sent TEXT CHECK(is_email_sent IN ('true', 'false')) DEFAULT 'false',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_user_entry_date 
ON daily_status_entries (employee_id, entry_date);

-- Auto updated_at Trigger
CREATE TRIGGER IF NOT EXISTS update_daily_status_entries_timestamp
AFTER UPDATE ON daily_status_entries
BEGIN
    UPDATE daily_status_entries
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- 4. AI Feedback / "Report" Table — snapshot of recent chat when a user taps
--    "Report" in the chatbot, so wrong AI replies can be reviewed and turned
--    into test cases / prompt examples. (See migrations/0002_add_ai_feedback.sql)
CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    note TEXT DEFAULT NULL,
    selected_project TEXT DEFAULT NULL,
    messages TEXT NOT NULL,            -- JSON: the last N {role, content, context} turns
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback (employee_id, created_at);

-- =========================================================================
-- FRESH SEED DATA (Remote database mein automatic load ke liye)
-- =========================================================================

-- Projects Insert
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