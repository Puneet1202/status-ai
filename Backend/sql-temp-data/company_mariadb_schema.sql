-- =========================================================================
-- KEYSS AI — COMPANY DATABASE (MariaDB / MySQL)  — 24 TABLES, STRUCTURE ONLY
-- Company ke statusk_test_2026 schema jaisa EXACTLY same. Ye D1/SQLite NAHI hai.
-- Local me chalane ke liye (XAMPP / MySQL / HeidiSQL):
--   mysql -u root -p < company_mariadb_schema.sql
-- Data bhi chahiye to iske bajaye compnay_schema_Data_.sql load karo.
-- =========================================================================

CREATE DATABASE IF NOT EXISTS statusk_test_2026
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE statusk_test_2026;

SET FOREIGN_KEY_CHECKS = 0;   -- FK order ki dikkat na aaye isliye
-- TABLE 1 =========================================
CREATE TABLE `appraisal_targets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appraisal_id` int(11) NOT NULL,
  `target_description` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `appraisal_id` (`appraisal_id`),
  CONSTRAINT `appraisal_targets_ibfk_1` FOREIGN KEY (`appraisal_id`) REFERENCES `appraisals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1273 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 2 =========================================
CREATE TABLE `appraisals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `appraiser_id` int(11) NOT NULL,
  `last_appraisal_id` int(11) DEFAULT NULL,
  `appraiser_date` date DEFAULT NULL,
  `status` enum('not_started','draft_by_employee','submitted_to_appraiser','sent_back_to_employee','pending_at_hr','completed') DEFAULT 'not_started',
  `past_year_review` text DEFAULT NULL,
  `achievements` text DEFAULT NULL,
  `org_likes_dislikes` text DEFAULT NULL,
  `other_issues` text DEFAULT NULL,
  `employee_submit_date` timestamp NULL DEFAULT NULL,
  `appraiser_review_date` timestamp NULL DEFAULT NULL,
  `hr_review_date` timestamp NULL DEFAULT NULL,
  `hr_comment` varchar(500) DEFAULT NULL,
  `ai_summary` text DEFAULT NULL COMMENT 'Stores the AI-generated summary of the employee''s past performance.',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`appraiser_date`),
  KEY `appraiser_id` (`appraiser_id`),
  CONSTRAINT `appraisals_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employee` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appraisals_ibfk_2` FOREIGN KEY (`appraiser_id`) REFERENCES `employee` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=262 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 3 =========================================
CREATE TABLE `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `date_format` varchar(15) NOT NULL DEFAULT 'd/m/Y',
  `client_dob` date DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `send_status` enum('true','false') NOT NULL DEFAULT 'false' COMMENT 'admin can allow or not for send the status email to the client',
  `receive_status` enum('true','false') NOT NULL DEFAULT 'false',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=151 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 4 =========================================
CREATE TABLE `daily_status_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `entry_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `duration_minutes` int(11) GENERATED ALWAYS AS (time_to_sec(timediff(`end_time`,`start_time`)) / 60) STORED,
  `task_description` text NOT NULL,
  `module_name` varchar(255) DEFAULT NULL,
  `is_email_sent` enum('false','true') DEFAULT 'false',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `idx_user_entry_date` (`employee_id`,`entry_date`),
  CONSTRAINT `daily_status_entries_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employee` (`id`) ON DELETE CASCADE,
  CONSTRAINT `daily_status_entries_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 5 =========================================
CREATE TABLE `designation` (
  `id` int(20) NOT NULL AUTO_INCREMENT,
  `designation` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 6 =========================================
CREATE TABLE `employee` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(100) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `designation_id` int(11) DEFAULT NULL,
  `pen_leaves` int(11) DEFAULT NULL,
  `last_appraisal_date` date DEFAULT NULL,
  `next_appraisal_date` date DEFAULT NULL,
  `review_stage` enum('Level One','Level Two','Level Three','Level Four') DEFAULT NULL,
  `appraiser_id` bigint(20) DEFAULT NULL,
  `leaving_date` date DEFAULT NULL,
  `leaving_feed_back` varchar(500) DEFAULT NULL,
  `P_Address` text DEFAULT NULL,
  `C_Address` text DEFAULT NULL,
  `P_Contact_num` varchar(20) DEFAULT NULL,
  `C_Contact_num` varchar(20) DEFAULT NULL,
  `send_status` enum('true','false') NOT NULL DEFAULT 'false' COMMENT 'admin allow or not to send the status email or not',
  `status_appraiser` enum('true','false') NOT NULL DEFAULT 'false',
  `status_self` enum('true','false') NOT NULL DEFAULT 'true',
  `read_policy_date` datetime DEFAULT NULL,
  `updated_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=349 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 7 =========================================
CREATE TABLE `employee_deleted` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(100) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `designation_id` int(11) DEFAULT NULL,
  `pen_leaves` int(11) DEFAULT NULL,
  `last_appraisal_date` date DEFAULT NULL,
  `next_appraisal_date` date DEFAULT NULL,
  `review_stage` enum('levelOne','levelTwo','levelThree','levelFour') DEFAULT NULL,
  `appraiser_id` bigint(20) DEFAULT NULL,
  `leaving_date` date DEFAULT NULL,
  `leaving_feed_back` varchar(500) DEFAULT NULL,
  `P_Address` text DEFAULT NULL,
  `C_Address` text DEFAULT NULL,
  `P_Contact_num` varchar(20) DEFAULT NULL,
  `C_Contact_num` varchar(20) DEFAULT NULL,
  `status_appraiser` enum('true','false') NOT NULL DEFAULT 'false',
  `status_self` enum('true','false') NOT NULL DEFAULT 'true',
  `read_policy_date` datetime DEFAULT NULL,
  `updated_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 8 =========================================
CREATE TABLE `employee_exit_checklist` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) NOT NULL,
  `exit_date` date NOT NULL,
  `address` varchar(255) NOT NULL,
  `phone_number` varchar(255) NOT NULL,
  `last_working_date` date NOT NULL,
  `notice_period` int(2) NOT NULL,
  `notice_served` int(2) NOT NULL,
  `eligible_rehire` tinyint(1) NOT NULL,
  `resignation_email_date` date NOT NULL,
  `work_handover_rating` int(2) NOT NULL,
  `work_handover_emp_id` int(2) NOT NULL,
  `work_handover_emp_name` varchar(50) NOT NULL,
  `company_property_return_status` tinyint(1) NOT NULL,
  `returned_items` varchar(200) NOT NULL,
  `credential_changed` tinyint(1) NOT NULL,
  `status_updated` tinyint(1) NOT NULL,
  `eligible_rehire_confirm` tinyint(1) NOT NULL,
  `status_id_deleted` tinyint(1) NOT NULL,
  `email_id_deleted` tinyint(1) NOT NULL,
  `salary_transfered` tinyint(1) NOT NULL,
  `salary_transfered_date` date NOT NULL,
  `experience_certificate_issued` tinyint(1) NOT NULL,
  `experience_certificate_issued_date` date NOT NULL,
  `comment` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 9 =========================================
CREATE TABLE `employee_feedback` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) DEFAULT NULL,
  `make_realistic_goals` varchar(100) DEFAULT NULL,
  `meets_deadlines` varchar(100) DEFAULT NULL,
  `work_smarter_ not_harder` varchar(100) DEFAULT NULL,
  `looks_for_efficencies` varchar(100) DEFAULT NULL,
  `completes_tasks` varchar(100) DEFAULT NULL,
  `shows_good_judgements` varchar(100) DEFAULT NULL,
  `processes_recieved_information` varchar(100) DEFAULT NULL,
  `listen_to_others` varchar(100) DEFAULT NULL,
  `verbal_communications` varchar(100) DEFAULT NULL,
  `written_communications` varchar(100) DEFAULT NULL,
  `email_etiquette` varchar(100) DEFAULT NULL,
  `telephone_etiquette` varchar(100) DEFAULT NULL,
  `leads_by_example` varchar(100) DEFAULT NULL,
  `finds_realistic_solutions` varchar(50) DEFAULT NULL,
  `acts_decisively` varchar(100) DEFAULT NULL,
  `brings_out_the_best_in_team_members` varchar(100) DEFAULT NULL,
  `resolves_conflicts` varchar(100) DEFAULT NULL,
  `establishes_clear_expectations` varchar(11) DEFAULT NULL,
  `provides_necessary_resources` varchar(11) DEFAULT NULL,
  `delegates_clearly` varchar(11) DEFAULT NULL,
  `even_tempered_under_pressure` varchar(11) DEFAULT NULL,
  `sets_high_standards_for_self` varchar(11) DEFAULT NULL,
  `sets_challenging_goals` varchar(11) DEFAULT NULL,
  `strong_customer_advocate` varchar(11) DEFAULT NULL,
  `sets_aside_personal_biases_and_wants` varchar(11) DEFAULT NULL,
  `gives_good_practical_advice` varchar(11) DEFAULT NULL,
  `foster_loyality_in_employees` varchar(11) DEFAULT NULL,
  `priortizes_tasks` varchar(20) DEFAULT NULL,
  `responds_quickly_and_well_to_problems` varchar(20) DEFAULT NULL,
  `manages_costs_effectively` varchar(20) DEFAULT NULL,
  `develops_new_strategies` varchar(20) DEFAULT NULL,
  `organizes_tasks` varchar(20) DEFAULT NULL,
  `goals_for_next_review_period` varchar(200) DEFAULT NULL,
  `emp_name` varchar(20) DEFAULT NULL,
  `from_date` varchar(20) DEFAULT NULL,
  `to_date` varchar(20) DEFAULT NULL,
  `designation` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 10 =========================================
CREATE TABLE `employee_leave_balances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `leave_category_id` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `allotted_days` decimal(4,1) NOT NULL,
  `taken_days` decimal(4,1) NOT NULL DEFAULT 0.0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_category_year` (`employee_id`,`leave_category_id`,`year`),
  KEY `leave_category_id` (`leave_category_id`),
  CONSTRAINT `employee_leave_balances_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employee` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_leave_balances_ibfk_2` FOREIGN KEY (`leave_category_id`) REFERENCES `leave_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=412 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 11 =========================================
CREATE TABLE `employee_register_checklist` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) NOT NULL,
  `cv_signed` tinyint(1) NOT NULL,
  `academic_testimonial` tinyint(1) NOT NULL,
  `technical_certificate` tinyint(1) NOT NULL,
  `passport_images` tinyint(1) NOT NULL,
  `pancard_copy` tinyint(1) NOT NULL,
  `address_copy` tinyint(1) NOT NULL,
  `address_verification` tinyint(1) NOT NULL,
  `handbook_shared` tinyint(1) NOT NULL,
  `offer_letter` tinyint(1) NOT NULL,
  `nda` tinyint(1) NOT NULL,
  `email_policy` tinyint(1) NOT NULL,
  `infrastructure_usage_policy` tinyint(1) NOT NULL,
  `information_security_policy` tinyint(1) NOT NULL,
  `training_agreement` tinyint(1) NOT NULL,
  `appointment_letter` tinyint(1) NOT NULL,
  `police_verification` tinyint(1) NOT NULL,
  `status_id_created` tinyint(1) NOT NULL,
  `email_id_created` tinyint(1) NOT NULL,
  `biomatric_registeration` tinyint(1) NOT NULL,
  `team_introduction` tinyint(1) NOT NULL,
  `machine_assigned` tinyint(1) NOT NULL,
  `experience_certificate` tinyint(1) NOT NULL,
  `document_verification` tinyint(1) NOT NULL,
  `form16_submission` tinyint(1) NOT NULL,
  `last_month_salary_slip` tinyint(1) NOT NULL,
  `last_employement_form` tinyint(1) NOT NULL,
  `comment` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 12 =========================================
CREATE TABLE `holiday` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date DEFAULT NULL,
  `name` varchar(40) DEFAULT NULL,
  `updated_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=184 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 13 =========================================
CREATE TABLE `last_appraisal_achievement` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `last_appraisal_id` int(11) NOT NULL,
  `target_description` text NOT NULL,
  `employee_rating` varchar(100) NOT NULL,
  `employee_rating_comment` text NOT NULL,
  `appraiser_rating` varchar(100) NOT NULL,
  `appraiser_rating_comment` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `last_appraisal_id` (`last_appraisal_id`),
  CONSTRAINT `last_appraisal_achievement_ibfk_1` FOREIGN KEY (`last_appraisal_id`) REFERENCES `appraisals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=692 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 14 =========================================
CREATE TABLE `leave_action_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(255) NOT NULL,
  `leave_id` int(11) NOT NULL,
  `appraiser_id` int(11) NOT NULL,
  `action` enum('approve','reject') NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_token` (`token`),
  KEY `idx_leave_id` (`leave_id`),
  KEY `idx_appraiser_id` (`appraiser_id`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_action` (`action`),
  KEY `idx_token_expiry` (`token`,`expires_at`),
  KEY `idx_leave_action` (`leave_id`,`action`,`expires_at`),
  CONSTRAINT `fk_leave_action_tokens_appraiser_id` FOREIGN KEY (`appraiser_id`) REFERENCES `employee` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_leave_action_tokens_leave_id` FOREIGN KEY (`leave_id`) REFERENCES `leave_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 15 =========================================
CREATE TABLE `leave_applications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `leave_category_id` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` int(11) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `contact_details` varchar(100) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by_employee_id` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `leave_category_id` (`leave_category_id`),
  KEY `reviewed_by_employee_id` (`reviewed_by_employee_id`),
  CONSTRAINT `leave_applications_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employee` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_applications_ibfk_2` FOREIGN KEY (`leave_category_id`) REFERENCES `leave_categories` (`id`),
  CONSTRAINT `leave_applications_ibfk_3` FOREIGN KEY (`reviewed_by_employee_id`) REFERENCES `employee` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 16 =========================================
CREATE TABLE `leave_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `status` int(11) NOT NULL DEFAULT 0,
  `description` text DEFAULT NULL,
  `is_auto_generated` tinyint(1) DEFAULT 0,
  `max_consecutive_days_allowed` int(11) DEFAULT NULL,
  `min_notice_period_days` int(11) NOT NULL DEFAULT 0,
  `is_document_required` tinyint(1) NOT NULL DEFAULT 0,
  `document_required_after_days` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 17 =========================================
CREATE TABLE `otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `otp_code` varchar(10) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_expires_at` (`user_id`,`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=455 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 18 =========================================
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT ' e.g., ''manage_employees'', ''enter_daily_status'', ''approve_leaves'' ',
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 19 =========================================
CREATE TABLE `policy` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_policy` text DEFAULT NULL,
  `update_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 20 =========================================
CREATE TABLE `project_assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 21 =========================================
CREATE TABLE `projects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','completed','on_hold') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=151 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 22 =========================================
CREATE TABLE `role_permissions` (
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 23 =========================================
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT 'e.g., ''superadmin'', ''admin'', ''hr'', ''employee'', ''client'' ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- TABLE 24 =========================================
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `client_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  KEY `client_id` (`client_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_3` FOREIGN KEY (`employee_id`) REFERENCES `employee` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2263 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;


SET FOREIGN_KEY_CHECKS = 1;
