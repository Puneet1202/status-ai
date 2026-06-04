-- Migration (MariaDB) 0002 — 2 AI-EXTRA tables (company ke 24 ke alawa).
-- Ye company HR system ka part NAHI hai — sirf AI ki suvidha ke liye:
--   project_tasks : har project ke predefined task naam (UI dropdown)
--   ai_feedback   : "Report" button — galat AI reply ka chat snapshot
-- Company website inhe ignore karti hai. Total tables: 24 + 2 = 26.
--
-- phpMyAdmin: statusk_test_2026 → SQL tab → paste → Go

USE statusk_test_2026;

CREATE TABLE IF NOT EXISTS project_tasks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_name  VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proj_task (project_id, task_name),
  CONSTRAINT fk_pt_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_feedback (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  employee_id      INT NOT NULL,
  note             TEXT NULL,
  selected_project VARCHAR(255) NULL,
  messages         TEXT NOT NULL,        -- JSON: last N {role, content, context} turns
  transcript       TEXT NULL,            -- human-readable rendering of messages
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_aifb_user (employee_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
