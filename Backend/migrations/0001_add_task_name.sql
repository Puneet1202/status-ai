-- Migration 0001 — add `task_name` to daily_status_entries (user-selected
-- predefined project task(s)). module_name stays the AI auto-derived category.
--
-- Run against the LIVE D1:
--   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0001_add_task_name.sql
-- (use --local for the local dev DB)
--
-- This REBUILDS the table so the new column sits right after task_description
-- AND existing rows are preserved. (SQLite's ALTER ADD COLUMN can only append
-- at the end; a rebuild is the standard way to control column order.)

CREATE TABLE daily_status_entries_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER,
    task_description TEXT NOT NULL,
    task_name TEXT DEFAULT NULL,
    module_name TEXT DEFAULT NULL,
    is_email_sent TEXT CHECK(is_email_sent IN ('true', 'false')) DEFAULT 'false',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Copy existing rows. If the old table doesn't yet have task_name, this SELECT
-- still works because we list task_name explicitly only when present; for a
-- table without it, replace `task_name` below with `NULL AS task_name`.
INSERT INTO daily_status_entries_new
    (id, employee_id, project_id, entry_date, start_time, end_time, duration_minutes,
     task_description, task_name, module_name, is_email_sent, created_at, updated_at)
SELECT
    id, employee_id, project_id, entry_date, start_time, end_time, duration_minutes,
    task_description,
    NULL AS task_name,
    module_name, is_email_sent, created_at, updated_at
FROM daily_status_entries;

DROP TABLE daily_status_entries;
ALTER TABLE daily_status_entries_new RENAME TO daily_status_entries;

CREATE INDEX IF NOT EXISTS idx_user_entry_date ON daily_status_entries (employee_id, entry_date);

CREATE TRIGGER IF NOT EXISTS update_daily_status_entries_timestamp
AFTER UPDATE ON daily_status_entries
BEGIN
    UPDATE daily_status_entries SET updated_at = datetime('now') WHERE id = NEW.id;
END;
