-- Full schema extracted from keyss-status.prod.db (D1/SQLite)
-- Generated for the migration guide. Schema only, NO data.

-- [TABLE] appraisal_targets
CREATE TABLE "appraisal_targets" (
	"id"	INTEGER,
	"appraisal_id"	INTEGER NOT NULL,
	"target_description"	TEXT NOT NULL,
	"created_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("appraisal_id") REFERENCES "appraisals"("id") ON DELETE CASCADE
);

-- [TABLE] appraisals
CREATE TABLE "appraisals" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"appraiser_id"	INTEGER NOT NULL,
	"last_appraisal_id"	INTEGER DEFAULT NULL,
	"appraiser_date"	TEXT DEFAULT NULL,
	"status"	TEXT DEFAULT 'not_started' CHECK("status" IN ('not_started', 'draft_by_employee', 'submitted_to_appraiser', 'sent_back_to_employee', 'pending_at_hr', 'completed')),
	"past_year_review"	TEXT DEFAULT NULL,
	"achievements"	TEXT DEFAULT NULL,
	"org_likes_dislikes"	TEXT DEFAULT NULL,
	"other_issues"	TEXT DEFAULT NULL,
	"employee_submit_date"	TEXT DEFAULT NULL,
	"appraiser_review_date"	TEXT DEFAULT NULL,
	"hr_review_date"	TEXT DEFAULT NULL,
	"hr_comment"	TEXT DEFAULT NULL,
	"ai_summary"	TEXT DEFAULT NULL,
	"created_at"	TEXT DEFAULT (datetime('now')),
	"updated_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("appraiser_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE
);

-- [TABLE] clients
CREATE TABLE "clients" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"date_format"	TEXT NOT NULL DEFAULT 'd/m/Y',
	"client_dob"	TEXT DEFAULT NULL,
	"contact_person"	TEXT DEFAULT NULL,
	"send_status"	TEXT NOT NULL DEFAULT 'false' CHECK("send_status" IN ('true', 'false')),
	"receive_status"	TEXT NOT NULL DEFAULT 'false' CHECK("receive_status" IN ('true', 'false')),
	"created_at"	TEXT DEFAULT (datetime('now')),
	"updated_at"	TEXT DEFAULT (datetime('now')), "is_deleted" INTEGER NOT NULL DEFAULT 0, "email" TEXT NOT NULL DEFAULT '',
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] d1_migrations
CREATE TABLE "d1_migrations" (
	"id"	INTEGER,
	"name"	TEXT UNIQUE,
	"applied_at"	TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] daily_status_entries
CREATE TABLE "daily_status_entries" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"project_id"	INTEGER NOT NULL,
	"entry_date"	TEXT NOT NULL,
	"start_time"	TEXT NOT NULL,
	"end_time"	TEXT NOT NULL,
	"duration_minutes"	INTEGER,
	"task_description"	TEXT NOT NULL,
	"module_name"	TEXT DEFAULT NULL,
	"is_email_sent"	TEXT NOT NULL DEFAULT 'false' CHECK("is_email_sent" IN ('false', 'true')),
	"created_at"	TEXT DEFAULT (datetime('now')),
	"updated_at"	TEXT DEFAULT (datetime('now')), "task_id" INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

-- [TABLE] designation
CREATE TABLE "designation" (
	"id"	INTEGER,
	"designation"	TEXT DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] employee
CREATE TABLE "employee" (
	"id"	INTEGER,
	"name"	TEXT DEFAULT NULL,
	"dob"	TEXT DEFAULT NULL,
	"joining_date"	TEXT DEFAULT NULL,
	"designation_id"	INTEGER DEFAULT NULL,
	"pen_leaves"	INTEGER DEFAULT NULL,
	"last_appraisal_date"	TEXT DEFAULT NULL,
	"next_appraisal_date"	TEXT DEFAULT NULL,
	"review_stage"	TEXT DEFAULT NULL CHECK("review_stage" IN ('Level One', 'Level Two', 'Level Three', 'Level Four')),
	"appraiser_id"	INTEGER DEFAULT NULL,
	"leaving_date"	TEXT DEFAULT NULL,
	"leaving_feed_back"	TEXT DEFAULT NULL,
	"P_Address"	TEXT DEFAULT NULL,
	"C_Address"	TEXT DEFAULT NULL,
	"P_Contact_num"	TEXT DEFAULT NULL,
	"C_Contact_num"	TEXT DEFAULT NULL,
	"send_status"	TEXT NOT NULL DEFAULT 'false' CHECK("send_status" IN ('true', 'false')),
	"status_appraiser"	TEXT NOT NULL DEFAULT 'false' CHECK("status_appraiser" IN ('true', 'false')),
	"status_self"	TEXT NOT NULL DEFAULT 'true' CHECK("status_self" IN ('true', 'false')),
	"read_policy_date"	TEXT DEFAULT NULL,
	"updated_time"	TEXT NOT NULL DEFAULT (datetime('now')), "working_schedule" TEXT NOT NULL DEFAULT '{}', "country" TEXT, "state" TEXT, "city" TEXT, "use_default_schedule" INTEGER NOT NULL DEFAULT 1
  CHECK("use_default_schedule" IN (0, 1)),
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] employee_deleted
CREATE TABLE "employee_deleted" (
	"id"	INTEGER,
	"name"	TEXT DEFAULT NULL,
	"dob"	TEXT DEFAULT NULL,
	"joining_date"	TEXT DEFAULT NULL,
	"designation_id"	INTEGER DEFAULT NULL,
	"pen_leaves"	INTEGER DEFAULT NULL,
	"last_appraisal_date"	TEXT DEFAULT NULL,
	"next_appraisal_date"	TEXT DEFAULT NULL,
	"review_stage"	TEXT DEFAULT NULL CHECK("review_stage" IN ('levelOne', 'levelTwo', 'levelThree', 'levelFour')),
	"appraiser_id"	INTEGER DEFAULT NULL,
	"leaving_date"	TEXT DEFAULT NULL,
	"leaving_feed_back"	TEXT DEFAULT NULL,
	"P_Address"	TEXT DEFAULT NULL,
	"C_Address"	TEXT DEFAULT NULL,
	"P_Contact_num"	TEXT DEFAULT NULL,
	"C_Contact_num"	TEXT DEFAULT NULL,
	"status_appraiser"	TEXT NOT NULL DEFAULT 'false' CHECK("status_appraiser" IN ('true', 'false')),
	"status_self"	TEXT NOT NULL DEFAULT 'true' CHECK("status_self" IN ('true', 'false')),
	"read_policy_date"	TEXT DEFAULT NULL,
	"updated_time"	TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] employee_exit_checklist
CREATE TABLE "employee_exit_checklist" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"exit_date"	TEXT NOT NULL,
	"address"	TEXT NOT NULL,
	"phone_number"	TEXT NOT NULL,
	"last_working_date"	TEXT NOT NULL,
	"notice_period"	INTEGER NOT NULL,
	"notice_served"	INTEGER NOT NULL,
	"eligible_rehire"	INTEGER NOT NULL,
	"resignation_email_date"	TEXT NOT NULL,
	"work_handover_rating"	INTEGER NOT NULL,
	"work_handover_emp_id"	INTEGER NOT NULL,
	"work_handover_emp_name"	TEXT NOT NULL,
	"company_property_return_status"	INTEGER NOT NULL,
	"returned_items"	TEXT NOT NULL,
	"credential_changed"	INTEGER NOT NULL,
	"status_updated"	INTEGER NOT NULL,
	"eligible_rehire_confirm"	INTEGER NOT NULL,
	"status_id_deleted"	INTEGER NOT NULL,
	"email_id_deleted"	INTEGER NOT NULL,
	"salary_transfered"	INTEGER NOT NULL,
	"salary_transfered_date"	TEXT NOT NULL,
	"experience_certificate_issued"	INTEGER NOT NULL,
	"experience_certificate_issued_date"	TEXT NOT NULL,
	"comment"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] employee_feedback
CREATE TABLE "employee_feedback" (
	"id"	INTEGER,
	"employee_id"	INTEGER DEFAULT NULL,
	"make_realistic_goals"	TEXT DEFAULT NULL,
	"meets_deadlines"	TEXT DEFAULT NULL,
	"work_smarter_ not_harder"	TEXT DEFAULT NULL,
	"looks_for_efficencies"	TEXT DEFAULT NULL,
	"completes_tasks"	TEXT DEFAULT NULL,
	"shows_good_judgements"	TEXT DEFAULT NULL,
	"processes_recieved_information"	TEXT DEFAULT NULL,
	"listen_to_others"	TEXT DEFAULT NULL,
	"verbal_communications"	TEXT DEFAULT NULL,
	"written_communications"	TEXT DEFAULT NULL,
	"email_etiquette"	TEXT DEFAULT NULL,
	"telephone_etiquette"	TEXT DEFAULT NULL,
	"leads_by_example"	TEXT DEFAULT NULL,
	"finds_realistic_solutions"	TEXT DEFAULT NULL,
	"acts_decisively"	TEXT DEFAULT NULL,
	"brings_out_the_best_in_team_members"	TEXT DEFAULT NULL,
	"resolves_conflicts"	TEXT DEFAULT NULL,
	"establishes_clear_expectations"	TEXT DEFAULT NULL,
	"provides_necessary_resources"	TEXT DEFAULT NULL,
	"delegates_clearly"	TEXT DEFAULT NULL,
	"even_tempered_under_pressure"	TEXT DEFAULT NULL,
	"sets_high_standards_for_self"	TEXT DEFAULT NULL,
	"sets_challenging_goals"	TEXT DEFAULT NULL,
	"strong_customer_advocate"	TEXT DEFAULT NULL,
	"sets_aside_personal_biases_and_wants"	TEXT DEFAULT NULL,
	"gives_good_practical_advice"	TEXT DEFAULT NULL,
	"foster_loyality_in_employees"	TEXT DEFAULT NULL,
	"priortizes_tasks"	TEXT DEFAULT NULL,
	"responds_quickly_and_well_to_problems"	TEXT DEFAULT NULL,
	"manages_costs_effectively"	TEXT DEFAULT NULL,
	"develops_new_strategies"	TEXT DEFAULT NULL,
	"organizes_tasks"	TEXT DEFAULT NULL,
	"goals_for_next_review_period"	TEXT DEFAULT NULL,
	"emp_name"	TEXT DEFAULT NULL,
	"from_date"	TEXT DEFAULT NULL,
	"to_date"	TEXT DEFAULT NULL,
	"designation"	TEXT DEFAULT NULL, "work_smarter_not_harder" TEXT DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] employee_leave_balances
CREATE TABLE "employee_leave_balances" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"leave_category_id"	INTEGER NOT NULL,
	"year"	INTEGER NOT NULL,
	"allotted_days"	REAL NOT NULL,
	"taken_days"	REAL NOT NULL DEFAULT 0.0,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("leave_category_id") REFERENCES "leave_categories"("id") ON DELETE CASCADE
);

-- [TABLE] employee_register_checklist
CREATE TABLE "employee_register_checklist" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"cv_signed"	INTEGER NOT NULL DEFAULT 0,
	"academic_testimonial"	INTEGER NOT NULL DEFAULT 0,
	"technical_certificate"	INTEGER NOT NULL DEFAULT 0,
	"passport_images"	INTEGER NOT NULL DEFAULT 0,
	"pancard_copy"	INTEGER NOT NULL DEFAULT 0,
	"address_copy"	INTEGER NOT NULL DEFAULT 0,
	"address_verification"	INTEGER NOT NULL DEFAULT 0,
	"handbook_shared"	INTEGER NOT NULL DEFAULT 0,
	"offer_letter"	INTEGER NOT NULL DEFAULT 0,
	"nda"	INTEGER NOT NULL DEFAULT 0,
	"email_policy"	INTEGER NOT NULL DEFAULT 0,
	"infrastructure_usage_policy"	INTEGER NOT NULL DEFAULT 0,
	"information_security_policy"	INTEGER NOT NULL DEFAULT 0,
	"training_agreement"	INTEGER NOT NULL DEFAULT 0,
	"appointment_letter"	INTEGER NOT NULL DEFAULT 0,
	"police_verification"	INTEGER NOT NULL DEFAULT 0,
	"status_id_created"	INTEGER NOT NULL DEFAULT 0,
	"email_id_created"	INTEGER NOT NULL DEFAULT 0,
	"biomatric_registeration"	INTEGER NOT NULL DEFAULT 0,
	"team_introduction"	INTEGER NOT NULL DEFAULT 0,
	"machine_assigned"	INTEGER NOT NULL DEFAULT 0,
	"experience_certificate"	INTEGER NOT NULL DEFAULT 0,
	"document_verification"	INTEGER NOT NULL DEFAULT 0,
	"form16_submission"	INTEGER NOT NULL DEFAULT 0,
	"last_month_salary_slip"	INTEGER NOT NULL DEFAULT 0,
	"last_employement_form"	INTEGER NOT NULL DEFAULT 0,
	"comment"	TEXT DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] holiday
CREATE TABLE "holiday" (
	"id"	INTEGER,
	"date"	TEXT DEFAULT NULL,
	"name"	TEXT DEFAULT NULL,
	"updated_time"	TEXT NOT NULL DEFAULT (datetime('now')), "holiday_type" TEXT NOT NULL DEFAULT 'National', "scope" TEXT NOT NULL DEFAULT 'Global', "status" TEXT NOT NULL DEFAULT 'Scheduled', "description" TEXT, "country" TEXT, "state" TEXT, "city" TEXT, "deleted_at" TEXT DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] last_appraisal_achievement
CREATE TABLE "last_appraisal_achievement" (
	"id"	INTEGER,
	"last_appraisal_id"	INTEGER NOT NULL,
	"target_description"	TEXT NOT NULL,
	"employee_rating"	TEXT NOT NULL,
	"employee_rating_comment"	TEXT NOT NULL,
	"appraiser_rating"	TEXT NOT NULL,
	"appraiser_rating_comment"	TEXT NOT NULL,
	"created_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("last_appraisal_id") REFERENCES "appraisals"("id") ON DELETE CASCADE
);

-- [TABLE] leave_action_tokens
CREATE TABLE "leave_action_tokens" (
	"id"	INTEGER,
	"token"	TEXT NOT NULL UNIQUE,
	"leave_id"	INTEGER NOT NULL,
	"appraiser_id"	INTEGER NOT NULL,
	"action"	TEXT NOT NULL CHECK("action" IN ('approve', 'reject')),
	"expires_at"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("appraiser_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("leave_id") REFERENCES "leave_applications"("id") ON DELETE CASCADE
);

-- [TABLE] leave_applications
CREATE TABLE "leave_applications" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"leave_category_id"	INTEGER NOT NULL,
	"start_date"	TEXT NOT NULL,
	"end_date"	TEXT NOT NULL,
	"total_days"	INTEGER DEFAULT NULL,
	"reason"	TEXT DEFAULT NULL,
	"contact_details"	TEXT DEFAULT NULL,
	"status"	TEXT DEFAULT 'pending' CHECK("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
	"reviewed_by_employee_id"	INTEGER DEFAULT NULL,
	"reviewed_at"	TEXT DEFAULT NULL,
	"created_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("leave_category_id") REFERENCES "leave_categories"("id"),
	FOREIGN KEY("reviewed_by_employee_id") REFERENCES "employee"("id")
);

-- [TABLE] leave_categories
CREATE TABLE "leave_categories" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL UNIQUE,
	"status"	INTEGER NOT NULL DEFAULT 0,
	"description"	TEXT DEFAULT NULL,
	"is_auto_generated"	INTEGER DEFAULT 0,
	"max_consecutive_days_allowed"	INTEGER DEFAULT NULL,
	"min_notice_period_days"	INTEGER NOT NULL DEFAULT 0,
	"is_document_required"	INTEGER NOT NULL DEFAULT 0,
	"document_required_after_days"	INTEGER DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] otps
CREATE TABLE "otps" (
	"id"	INTEGER,
	"user_id"	INTEGER NOT NULL,
	"identifier"	TEXT NOT NULL,
	"otp_code"	TEXT NOT NULL,
	"expires_at"	TEXT NOT NULL,
	"is_used"	INTEGER DEFAULT 0,
	"created_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- [TABLE] permissions
CREATE TABLE "permissions" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL UNIQUE,
	"description"	TEXT DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] policy
CREATE TABLE "policy" (
	"id"	INTEGER,
	"company_policy"	TEXT DEFAULT NULL,
	"update_date"	TEXT DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] project_assignments
CREATE TABLE "project_assignments" (
	"id"	INTEGER,
	"employee_id"	INTEGER NOT NULL,
	"project_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

-- [TABLE] projects
CREATE TABLE "projects" (
	"id"	INTEGER,
	"client_id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"description"	TEXT DEFAULT NULL,
	"status"	TEXT DEFAULT 'active' CHECK("status" IN ('active', 'completed', 'on_hold', 'deleted')),
	"created_at"	TEXT DEFAULT (datetime('now')),
	"updated_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("client_id") REFERENCES "clients"("id") ON DELETE CASCADE
);

-- [TABLE] role_permissions
CREATE TABLE "role_permissions" (
	"role_id"	INTEGER NOT NULL,
	"permission_id"	INTEGER NOT NULL,
	PRIMARY KEY("role_id","permission_id"),
	FOREIGN KEY("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE,
	FOREIGN KEY("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
);

-- [TABLE] roles
CREATE TABLE "roles" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL UNIQUE, "level" INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] system_configurations
CREATE TABLE "system_configurations" (
	"id"	INTEGER,
	"key"	TEXT NOT NULL UNIQUE,
	"value"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] task_attachments
CREATE TABLE "task_attachments" (
	"id"	INTEGER,
	"task_id"	INTEGER NOT NULL,
	"file_name"	TEXT NOT NULL,
	"file_path"	TEXT NOT NULL,
	"file_size"	INTEGER NOT NULL,
	"uploaded_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
);

-- [TABLE] task_comments
CREATE TABLE "task_comments" (
	"id"	INTEGER,
	"task_id"	INTEGER NOT NULL,
	"employee_id"	INTEGER NOT NULL,
	"comment_text"	TEXT NOT NULL,
	"created_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
);

-- [TABLE] task_history_logs
CREATE TABLE "task_history_logs" (
	"id"	INTEGER,
	"task_id"	INTEGER NOT NULL,
	"changed_by_employee_id"	INTEGER NOT NULL,
	"column_changed"	TEXT NOT NULL,
	"old_value"	TEXT DEFAULT NULL,
	"new_value"	TEXT DEFAULT NULL,
	"changed_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("changed_by_employee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
);

-- [TABLE] task_label_mappings
CREATE TABLE "task_label_mappings" (
	"task_id"	INTEGER NOT NULL,
	"label_id"	INTEGER NOT NULL,
	PRIMARY KEY("task_id","label_id"),
	FOREIGN KEY("label_id") REFERENCES "task_labels"("id") ON DELETE CASCADE,
	FOREIGN KEY("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
);

-- [TABLE] task_labels
CREATE TABLE "task_labels" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL UNIQUE,
	"color_code"	TEXT NOT NULL DEFAULT '#E2E8F0',
	PRIMARY KEY("id" AUTOINCREMENT)
);

-- [TABLE] tasks
CREATE TABLE "tasks" (
	"id"	INTEGER,
	"task_key"	TEXT NOT NULL UNIQUE,
	"project_id"	INTEGER NOT NULL,
	"module_name"	TEXT DEFAULT NULL,
	"title"	TEXT NOT NULL,
	"description"	TEXT DEFAULT NULL,
	"task_type"	TEXT NOT NULL CHECK("task_type" IN ('Development', 'Bug', 'Design', 'Marketing', 'Testing')),
	"status"	TEXT NOT NULL DEFAULT 'To Do' CHECK("status" IN ('To Do', 'In Progress', 'In Review', 'Completed', 'Blocked')),
	"priority"	TEXT NOT NULL DEFAULT 'Medium' CHECK("priority" IN ('Low', 'Medium', 'High')),
	"assignee_id"	INTEGER NOT NULL,
	"appraiser_id"	INTEGER DEFAULT NULL,
	"due_date"	TEXT NOT NULL,
	"estimated_hours"	REAL NOT NULL DEFAULT 0.0 CHECK("estimated_hours" >= 0.0),
	"created_at"	TEXT DEFAULT (datetime('now', 'localtime')),
	"updated_at"	TEXT DEFAULT (datetime('now', 'localtime')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("appraiser_id") REFERENCES "employee"("id") ON DELETE SET NULL,
	FOREIGN KEY("assignee_id") REFERENCES "employee"("id") ON DELETE CASCADE,
	FOREIGN KEY("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

-- [TABLE] users
CREATE TABLE "users" (
	"id"	INTEGER,
	"email"	TEXT NOT NULL UNIQUE,
	"role_id"	INTEGER NOT NULL,
	"employee_id"	INTEGER DEFAULT NULL,
	"client_id"	INTEGER DEFAULT NULL,
	"is_active"	INTEGER NOT NULL DEFAULT 1,
	"created_at"	TEXT DEFAULT (datetime('now')),
	"updated_at"	TEXT DEFAULT (datetime('now')),
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("client_id") REFERENCES "clients"("id") ON DELETE SET NULL,
	FOREIGN KEY("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL,
	FOREIGN KEY("role_id") REFERENCES "roles"("id")
);

-- [INDEX] idx_dse_employee_entry_date
CREATE INDEX "idx_dse_employee_entry_date"
  ON "daily_status_entries" ("employee_id", "entry_date");

-- [INDEX] idx_dse_project_id
CREATE INDEX "idx_dse_project_id"
  ON "daily_status_entries" ("project_id");

-- [INDEX] idx_leave_applications_employee
CREATE INDEX "idx_leave_applications_employee"
  ON "leave_applications" ("employee_id");

-- [INDEX] idx_leave_tokens_expires_at
CREATE INDEX "idx_leave_tokens_expires_at"
  ON "leave_action_tokens" ("expires_at");

-- [INDEX] idx_leave_tokens_leave_id
CREATE INDEX "idx_leave_tokens_leave_id"
  ON "leave_action_tokens" ("leave_id");

-- [INDEX] idx_projects_client_id
CREATE INDEX "idx_projects_client_id"
  ON "projects" ("client_id");

-- [INDEX] idx_tasks_assignee_id
CREATE INDEX "idx_tasks_assignee_id"
  ON "tasks" ("assignee_id");

-- [INDEX] idx_tasks_project_id
CREATE INDEX "idx_tasks_project_id"
  ON "tasks" ("project_id");

-- [INDEX] idx_users_role_id
CREATE INDEX "idx_users_role_id"
  ON "users" ("role_id");

-- [INDEX] uq_appraisals_employee_appraiser_date
CREATE UNIQUE INDEX "uq_appraisals_employee_appraiser_date"
  ON "appraisals" ("employee_id", "appraiser_date");

-- [INDEX] uq_leave_balances_emp_cat_year
CREATE UNIQUE INDEX "uq_leave_balances_emp_cat_year"
  ON "employee_leave_balances" ("employee_id", "leave_category_id", "year");
