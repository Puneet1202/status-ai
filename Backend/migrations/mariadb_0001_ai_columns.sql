-- Migration (MariaDB) 0001 — company schema ko AI app ke liye ready karna.
-- Ye ADDITIVE hai: company ke columns/data chhede bina, AI ke liye zaroori
-- columns add karta hai. statusk_test_2026 par ek hi baar chalao.
--
-- phpMyAdmin: statusk_test_2026 select karo -> SQL tab -> paste -> Go
-- (ya XAMPP shell se: mysql -u root statusk_test_2026 < migrations/mariadb_0001_ai_columns.sql)

USE statusk_test_2026;

-- users: AI app apna login khud karta hai (company users me ye columns nahi hote)
ALTER TABLE users
  ADD COLUMN name          VARCHAR(100) NULL              AFTER email,
  ADD COLUMN password_hash VARCHAR(255) NULL              AFTER name,
  ADD COLUMN role          VARCHAR(50)  NOT NULL DEFAULT 'employee' AFTER password_hash,
  MODIFY     role_id       INT NULL;   -- company me NOT NULL tha; app role_id set nahi karta

-- projects: AI sirf naam se project banata hai -> client_id optional
ALTER TABLE projects MODIFY client_id INT NULL;

-- daily_status_entries:
--   + task_name (AI EXTRA, user-selected task)
--   duration_minutes ko plain INT banao (company me GENERATED tha; app khud bharta
--     hai aur overnight shifts handle karta hai jo generated expr nahi karta)
--   employee_id ka FK hata do (app ka employee_id = uske apne users.id, company
--     employee table se map nahi — wo integration ka alag step hai)
ALTER TABLE daily_status_entries
  ADD COLUMN task_name VARCHAR(255) NULL AFTER task_description;
ALTER TABLE daily_status_entries
  DROP COLUMN duration_minutes,
  ADD COLUMN duration_minutes INT NULL AFTER end_time;
ALTER TABLE daily_status_entries
  DROP FOREIGN KEY daily_status_entries_ibfk_1;
