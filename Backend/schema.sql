-- Pehle sab drop karo
DROP TABLE IF EXISTS daily_status_entries;
DROP TABLE IF EXISTS projects;
DROP TRIGGER IF EXISTS update_daily_status_entries_timestamp;

-- Users same hai
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Main table
CREATE TABLE IF NOT EXISTS daily_status_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER,
    task_description TEXT NOT NULL,
    module_name TEXT DEFAULT NULL,
    is_email_sent TEXT CHECK(is_email_sent IN ('true', 'false')) DEFAULT 'false',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_user_entry_date 
ON daily_status_entries (employee_id, entry_date);

-- Auto updated_at trigger
CREATE TRIGGER IF NOT EXISTS update_daily_status_entries_timestamp
AFTER UPDATE ON daily_status_entries
BEGIN
    UPDATE daily_status_entries 
    SET updated_at = datetime('now') 
    WHERE id = NEW.id;
END;

-- Projects data
INSERT INTO projects (name) VALUES 
('Status App'),
('AI Project'),
('Core Infra V2'),
('Internal Tools'),
('Project-X');