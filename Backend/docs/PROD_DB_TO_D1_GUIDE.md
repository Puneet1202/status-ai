# Production DB → D1 Migration Guide (KEYSS Timesheet Backend)

> **Hand this file to the office AI assistant.** It is self-contained: it explains
> what happened, what `keyss-status.prod.db` actually is, exactly how to load it
> into Cloudflare D1, and every place the existing backend code must be aligned to
> the production schema. File paths are relative to the `Backend/` folder.

---

## TL;DR (Hinglish — for me / the team)

- **Backend dubara nahi banana.** Engine wahi hai — Cloudflare **D1 (SQLite)**. MariaDB wala detour **cancel**.
- `keyss-status.prod.db` **sach me D1 hi hai** (proof: andar `d1_migrations` table hai jo sirf wrangler banata hai; schema pure SQLite form me hai). D1 pe daalne se kuch nahi tootega.
- **prod.db hi naya base/source-of-truth hai** — schema + data dono uske andar saath hain. Schema alag se nahi likhna.
- D1 me file ka **path attach nahi hota**. Local pe file-swap se ya SQL import se data load karna hai; remote pe `wrangler d1 import`.
- Sirf **2 kaam** hain: **(A)** prod.db ka data D1 me load, **(B)** code ki kuch queries ko prod.db ke schema pe align (sabse bada: **auth/users**). Niche sab detail me hai.

---

## 1. Background — what happened

1. App was first built on **Cloudflare D1** (SQLite).
2. A senior asked to move to **SQL / MariaDB**. (Leftover from this: the `mysql2`
   package is still in `node_modules` — see §7 Housekeeping. Core code stayed on D1.)
3. Final decision: stay on **D1 SQLite**.
4. The company handed over real production data as a single file:
   **`Backend/keyss-status.prod.db`** (≈ 63 MB).

The open questions were: *do we rebuild the backend? does the schema get built on
this file, or do we attach it by path? is this file even D1-compatible?* —
answered below.

---

## 2. What `keyss-status.prod.db` actually is

A complete, ready **D1 / SQLite database** — schema **and** production data together.

**Proof it is genuinely D1 (not a raw MySQL dump):**

- It contains a `d1_migrations` table — a ledger **only wrangler/D1 creates**:
  ```
  001_mysql_to_d1_base.sql        (MySQL → D1 base conversion)
  002_add_missing_columns.sql
  003_add_missing_tables.sql
  004_indexes.sql
  005_production_backfill.sql     (production data loaded, 2026-06-04)
  ```
- The schema is in **pure SQLite form**: `INTEGER` / `TEXT` / `REAL`,
  `CHECK(col IN (...))` instead of MySQL `enum`, `PRIMARY KEY(... AUTOINCREMENT)`,
  `DEFAULT (datetime('now'))`. No `int(11)`, `varchar`, `ENGINE=InnoDB`, or backticks.
- File header: `SQLite format 3`.

So someone already did the MariaDB → D1 conversion **and** backfilled real data.
The MySQL-looking `sql-temp-data/extracted_tables_only.sql` was the *source*; this
`.db` is the finished *result*. **It will not break on D1.**

**Contents (32 tables). Key row counts:**

| Table | Rows | Notes |
|---|---:|---|
| `daily_status_entries` | 288,443 | the big timesheet data; has `task_id` (NOT `task_name`) |
| `users` | 281 | login identity only: `email`, `role_id`, `employee_id`, `client_id` — **no name/password/role** |
| `employee` | 214 | the *person* (name, dob, designation, …) |
| `projects` | 113 | `client_id` is **NOT NULL** |
| `clients` | 67 | |
| `appraisals` | 218 | full HR module |
| `roles` / `permissions` / `role_permissions` | 5 / 37 / 89 | RBAC |
| `otps` | 0 | **OTP login table exists → production auth is likely OTP/email, not password** |
| `tasks` | 0 | replaces the app's `project_tasks`; currently empty |
| `ai_feedback` | — | **NOT present** (the app expects it) |
| `project_tasks` | — | **NOT present** (the app expects it) |

Full schema is dumped (schema only, no data) in
[`docs/prod_db_schema.sql`](prod_db_schema.sql) — read that for exact columns.

**Binding (from `wrangler.toml`):**
```
binding        = "DB"
database_name  = "keyss-timesheet-db"
database_id    = "6b62c00b-66b3-4483-9e2e-e5f5aa791003"
```
Code reaches the DB via `c.env.DB` ([src/db/d1.js](../src/db/d1.js)). The file name
`keyss-status.prod.db` is just a source artifact — it is not referenced in code.

---

## 3. The plan — only two tasks

- **TASK A** — Load prod.db data into D1 (local first, then remote). §4
- **TASK B** — Align backend code to the prod.db schema. §5

Do **A locally** first, run the app, then fix **B**, then do **A remote** last.

---

## 4. TASK A — Load prod.db into D1

> ⚠️ D1 lives on Cloudflare; you **cannot point D1 at a `.db` path**. Local dev uses
> a SQLite file on disk (so a file-swap works); remote must be loaded via SQL import.

### A1 — LOCAL dev (fast path: file-swap)

wrangler/miniflare stores the local D1 as a `.sqlite` file under
`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`. Replace it with
the prod file.

```powershell
# From Backend/. Make sure `wrangler dev` is NOT running first.

# (optional) back up the current local dev DB
Copy-Item ".wrangler\state\v3\d1\miniflare-D1DatabaseObject\6111246e96871764f328dfc2ab58dd535f01d43b58dac64bd63d942b5b266972.sqlite" `
          "$env:TEMP\dev-d1-backup.sqlite" -Force

# overwrite local D1 with production data
Copy-Item "keyss-status.prod.db" `
          ".wrangler\state\v3\d1\miniflare-D1DatabaseObject\6111246e96871764f328dfc2ab58dd535f01d43b58dac64bd63d942b5b266972.sqlite" -Force
```

> The hash filename is machine-specific. If that exact file isn't there, pick the
> **largest** `*.sqlite` in that folder (ignore `metadata.sqlite`), or just use the
> import method below — it doesn't care about hashes.

**Verify:**
```powershell
npx wrangler d1 execute keyss-timesheet-db --local --command "SELECT COUNT(*) AS n FROM daily_status_entries"
# expect: 288443
```

### A1-alt — LOCAL via SQL import (if file-swap doesn't take)

```powershell
python docs\dump_prod_db.py                 # writes docs\prod_dump.sql
npx wrangler d1 execute keyss-timesheet-db --local --file=docs\prod_dump.sql
```

### A2 — REMOTE / production (do this LAST, after Task B works locally)

```powershell
python docs\dump_prod_db.py                 # writes docs\prod_dump.sql
npx wrangler d1 import keyss-timesheet-db --remote --file=docs\prod_dump.sql
```

**Gotchas for remote import:**
- It's ~60 MB → takes a few minutes. That's normal.
- `prod_dump.sql` already has `DROP TABLE IF EXISTS` guards, so re-running is safe.
- If you hit foreign-key errors, the dump is parent-before-child ordered already;
  worst case, import into a freshly reset D1.
- Check D1 storage limits for the account (63 MB is well within them).

**Verify remote:**
```powershell
npx wrangler d1 execute keyss-timesheet-db --remote --command "SELECT COUNT(*) AS n FROM daily_status_entries"
```

---

## 5. TASK B — Align backend code to the prod.db schema

The codebase is **half-migrated**: some queries already use the company schema
(e.g. the `projects → project_assignments → employee → users` join at
[timesheet.controller.js:285](../src/controllers/timesheet.controller.js)), but the
auth layer and a few timesheet queries still assume the **old "fat users" schema**.
Below is every mismatch found. None require a rewrite — they are targeted edits.

### The mismatch table

| # | Code location | Code assumes | prod.db reality | Fix direction |
|---|---|---|---|---|
| **M1 — auth** | [auth.controller.js](../src/controllers/auth.controller.js) register/login/`/me`/getAllUsers/refresh | `users.name`, `users.password_hash`, `users.role` | `users` = `id, email, role_id, employee_id, client_id, is_active, created_at, updated_at`. Name → `employee.name`; role → `roles.name` via `role_id`; **no password column anywhere** (`otps` table present) | **Team decision — see §5.1** |
| **M2 — identity** | [timesheet.controller.js:22](../src/controllers/timesheet.controller.js) `employeeId = currentUser.id`; JOIN `users u ON t.employee_id = u.id` ([:81](../src/controllers/timesheet.controller.js)) | `daily_status_entries.employee_id == users.id` | FK is → **`employee(id)`**, and `users.id ≠ employee.id` | Map logged-in `users.id` → `users.employee_id` → use that as `employee_id`. JOIN `employee`, not `users`. Carry `employee_id` in the JWT. |
| **M3 — task column** | [timesheet.controller.js:51](../src/controllers/timesheet.controller.js) & `:78`; [addTimesheet.tool.js:207](../src/ai/tools/addTimesheet.tool.js) | `daily_status_entries.task_name` | column is **`task_id`** (FK → `tasks`) | Insert/select `task_id`; JOIN `tasks` for the title. Or add a `task_name` column if you truly need free text. |
| **M4 — task table** | [timesheet.controller.js:319](../src/controllers/timesheet.controller.js); [addTimesheet.tool.js:191](../src/ai/tools/addTimesheet.tool.js) | `project_tasks(id, task_name, project_id)` | no such table; **`tasks`** has `task_key, title, project_id, assignee_id, status, …` | Repoint to `tasks`; map `task_name → title`; filter by `project_id`. (`tasks` is currently empty — see §6.) |
| **M5 — ai_feedback** | [timesheet.controller.js:250](../src/controllers/timesheet.controller.js) & `:256` | `ai_feedback` table (with `transcript`) | **not in prod.db** | Create it from `migrations/0002_add_ai_feedback.sql` + `0003_add_feedback_transcript.sql`. ⚠️ Those have `FOREIGN KEY (employee_id) REFERENCES users(id)` — change it to `employee(id)` to match M2. |
| **M6 — project autocreate** | [_helpers.js:19](../src/ai/tools/_helpers.js) `INSERT INTO projects (name)` | `projects` needs only `name` | `projects.client_id` is **NOT NULL, no default** | Supply a `client_id` (e.g. a dedicated "internal/AI" client), or disable AI auto-creation of projects. |

### 5.1 — The auth decision (most important)

In prod.db, login identity is **split** across three tables:
`users` (email + `role_id`/`employee_id`/`client_id` links) → `employee` (the
person's `name`) → `roles` (the role string). And there is **no `password_hash`
anywhere**, but there **is an `otps` table** — strongly implying production logs
people in by **email OTP, not password**.

The current code ([auth.controller.js](../src/controllers/auth.controller.js)) does
bcrypt password register/login and reads `user.name` / `user.role` /
`user.password_hash` directly off `users`. That breaks against prod.db. Pick one:

- **Option A — keep password auth (fastest, diverges from company schema).**
  `ALTER TABLE users ADD COLUMN name TEXT; ADD COLUMN password_hash TEXT; ADD COLUMN role TEXT;`
  Minimal code change. Downside: ignores `employee`/`roles`, duplicates data, and is
  *not* how the real company app authenticates.

- **Option B — align to company schema (most correct).** Resolve `name` via JOIN
  `employee`, `role` via JOIN `roles` on `role_id`, and switch login to **OTP**
  using the `otps` table. More work; needs the team's real auth flow.

- **Option C — bridge (middle).** Add only `password_hash` to `users`; derive
  `name`/`role` via JOIN. Keeps password login for this tool while respecting the
  company's person/role tables.

> **Before coding auth, ask the team: how does the real production app log users
> in — password, OTP, or SSO? Is this AI tool's login shared with the main app or
> standalone?** That answer picks A / B / C.

---

## 6. Decisions the team must confirm

1. **Auth model** — Option A / B / C above? How does production *actually* authenticate?
2. **Shared vs standalone login** — is this AI tool's auth the same as the main company app's?
3. **`employee_id` identity** — confirm timesheet rows key off `employee.id` (prod.db says yes) and decide to carry `employee_id` in the JWT.
4. **AI project auto-create** — which `client_id` should AI-created projects attach to, or should auto-create be disabled?
5. **Task model** — should AI entries link to `tasks.id`? Who/what populates `tasks` (currently 0 rows)?
6. **Legacy migrations** — confirm `migrations/0001–0004` are now **superseded by prod.db** and should be frozen (only cherry-pick the `ai_feedback` DDL — M5).

---

## 7. Housekeeping

- **Generated dump** — add to `.gitignore` so the 70 MB file is never committed:
  ```
  Backend/docs/prod_dump.sql
  ```
- **`keyss-status.prod.db` is already committed** to this repo (the "db data"
  commit), so it's available at the office as-is. If you'd rather not keep a 63 MB
  binary in history, untrack it (optional):
  ```powershell
  git rm --cached keyss-status.prod.db
  # then add `Backend/keyss-status.prod.db` to .gitignore and commit
  ```
- **Remove the MariaDB leftover.** Confirm nothing imports it, then drop `mysql2`:
  ```powershell
  npm ls mysql2          # see if anything depends on it
  npm remove mysql2      # if unused
  ```
- **Repo migrations are now legacy.** `migrations/0001–0004` describe the OLD D1
  schema (fat `users`, `task_name`, FK to `users`). **Do not run them against
  prod.db.** Keep only the `ai_feedback` DDL (M5) as a fresh add-on.

---

## 8. Verification checklist

- [ ] Local D1 has prod data: `daily_status_entries` count = **288443**.
- [ ] `npx wrangler dev` boots with no binding errors.
- [ ] **M5** applied: `ai_feedback` table exists locally.
- [ ] **M3/M4**: add-timesheet (REST + AI tool) inserts succeed against `task_id`/`tasks`.
- [ ] **M2**: a logged-in user's entries resolve via `employee_id` correctly (right rows, no FK error).
- [ ] **M1**: chosen auth option works end-to-end (login → `/me` → list).
- [ ] **M6**: AI project auto-create supplies a valid `client_id` (or is disabled).
- [ ] Only after all green locally → **A2 remote import** + remote count check.

---

## 9. Files in this package (`Backend/docs/`)

| File | Purpose |
|---|---|
| `PROD_DB_TO_D1_GUIDE.md` | this guide |
| `prod_db_schema.sql` | full schema (CREATE statements) extracted from prod.db — the target schema reference |
| `dump_prod_db.py` | generates `prod_dump.sql` (D1-import-ready SQL) from `keyss-status.prod.db` |
