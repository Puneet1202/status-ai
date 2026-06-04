# KEYSS AI — MariaDB Setup & Migration Guide



---

## 1. Ye project kya hai
**KEYSS** = ek AI timesheet assistant. User normal bhasha me (English/Hindi/Hinglish) apne kaam ke ghante likhta hai (e.g. "9-11 fixed login bug"), aur AI use samajh ke database me daal deta hai. Backend = **Hono (JavaScript)**. Frontend = React/Vite.

---

## 2. Ab tak kya kiya (summary)
Pehle ye app **Cloudflare D1 (SQLite)** par chal raha tha. Boss ne company ka asli **MariaDB schema** (`statusk_test_2026`, 24 tables) diya, taaki AI usi base par bane aur company ki nayi website se aaram se integrate ho.

Toh humne app ko **D1 se MariaDB** par shift kiya — **Hono + saara app code SAME hai**, sirf:
- **Runtime:** Cloudflare Workers → **Node.js** (`@hono/node-server`). *(Kyun? Cloudflare Worker seedhe MariaDB se connect nahi kar sakta — vo sirf D1/SQLite use karta hai.)*
- **Database:** D1 (SQLite) → **MariaDB** (`mysql2`).

Ek chhota **adapter** banaya jo MariaDB ko D1 jaisa "dikhata" hai, isliye purana tested code bina badle chalta hai.

### Kya-kya kaam karta hai (tested ✅)
| Feature | Status |
|---|---|
| Signup / Login (JWT token) | ✅ |
| AI se timesheet **add** | ✅ |
| **Get / Filter** (show hours) | ✅ |
| **Report** (galat AI reply save) | ✅ |
| Greetings / small talk | ✅ (basic) |
| **Update / Delete** | ⏳ Cloudflare AI token chahiye (neeche dekho) |

Edge-cases bhi bulletproof: overnight shift, 2-hour cap, lunch split, no-time (koi galat time invent nahi karta), overlap detection. 62 unit tests + 6/6 edge tests pass.

---

## 3. Database: 26 tables
- **24 tables** = company ke bilkul same (`compnay_schema_Data_.sql` se import).
- **+2 AI-extra tables** = `project_tasks` (predefined task dropdown) aur `ai_feedback` (Report button). Ye company HR system ka part NAHI — sirf AI ki suvidha, company website inhe ignore karti hai.

### AI ke liye jo chhote schema changes hue (additive — company columns delete/change NAHI kiye)
- `users` me add: `name`, `password_hash`, `role` (AI ka login); `role_id` ko optional kiya
- `projects.client_id` ko optional (AI sirf naam se project banata hai)
- `daily_status_entries` me add: `task_name`; `duration_minutes` ko plain banaya; employee-FK relax kiya

Ye sab `migrations/mariadb_0001_ai_columns.sql` aur `migrations/mariadb_0002_ai_extra_tables.sql` me hai.

---

## 4. 🖥️ LOCAL SETUP — Step by Step (office me bhi BILKUL yahi karna hai)

### Step 1 — XAMPP install karo (MariaDB + phpMyAdmin)
- Download: https://www.apachefriends.org → "XAMPP for Windows" → install.
- **XAMPP Control Panel** kholo → **Apache** Start + **MySQL** Start (dono green).

### Step 2 — Code laao
```
git clone <repo-url>
cd status-ai/Backend
npm install
```

### Step 3 — Database banao + company data import karo
- Browser: **http://localhost/phpmyadmin**
- Left "New" → database naam **`statusk_test_2026`** → Create.
- Us database pe click → **Import** tab → file chuno **`Backend/compnay_schema_Data_.sql`** → **Go**.
  - *(Ek "BDays view" wala red error aa sakta hai — vo HARMLESS hai, ignore karo. Saare 24 tables + data aa jaayenge.)*

### Step 4 — AI wali migrations chalao (24 → 26 tables + AI columns)
phpMyAdmin me `statusk_test_2026` select karke **SQL** tab me, ye 2 files ka content paste karke **Go**:
1. `Backend/migrations/mariadb_0001_ai_columns.sql`
2. `Backend/migrations/mariadb_0002_ai_extra_tables.sql`

### Step 5 — `.env` file banao
`Backend/.env` naam ki file banao (ye git me nahi hoti — secrets isliye). Ye daalo:
```
PORT=8787
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=statusk_test_2026

ACCESS_TOKEN_SECRET=<koi_bhi_lamba_random_string>
REFRESH_TOKEN_SECRET=<koi_aur_lamba_random_string>

AI_PROVIDER=cloudflare
CF_ACCOUNT_ID=
CF_API_TOKEN=
```
> JWT secrets koi bhi random lambi string ho sakti hai (Node khud token banata + verify karta hai). CF_* abhi khaali chhod sakte ho — bina inke bhi add/get/report chalega.

### Step 6 — Server chalao
```
npm run dev:node
```
Dikhna chahiye: `✅ KEYSS (Node + MariaDB) live → http://localhost:8787`

### Step 7 — Test (optional)
- `POST http://localhost:8787/api/auth/signup` → `{ "email":"a@a.com", "name":"A", "password":"pass1234" }`
- Phir `/api/auth/login` → token milega → AI chat use karo.

---

## 5. 📦 Data ko office le jaane ka tareeka
Local me jo data hai use le jaane ke liye **export** karo:
- phpMyAdmin → `statusk_test_2026` → **Export** tab → "Go" → ek `.sql` file download hogi.
- Office wale laptop me Step 3 wale tareeke se us file ko **Import** kar lo.

> Ya seedha `compnay_schema_Data_.sql` hi use karo agar sirf company ka original data chahiye.

---

## 6. Local vs Remote (Cloudflare) — confusion clear
- **Abhi sab LOCAL chalta hai** (aapke laptop ka MariaDB). Internet/server ki zaroorat nahi — isliye reliable hai.
- Purana Cloudflare/D1 wala setup (`npm run dev` = wrangler) ab **use nahi karna** — vo D1 ke liye tha.
- **Naya command:** `npm run dev:node` (Node + MariaDB).
- Jab company ki asli website se jodna hoga, tab app ko company ke MariaDB server ka address `.env` me daal denge — code wahi rahega.

---

## 7. ⏳ Abhi baaki kya hai
1. **Update / Delete + natural baat-cheet** ke liye ek **Cloudflare AI token** chahiye:
   - https://dash.cloudflare.com/profile/api-tokens → Create Token → **Workers AI** template → Create → copy.
   - `Backend/.env` me `CF_API_TOKEN=<paste>` aur `CF_ACCOUNT_ID=c874516a1e8d31b71447ad7385a56a7d` daalo → server restart.
   - Bas — update/delete apne aap chal padega (koi code change nahi).
2. **Employee mapping:** abhi AI app ka login (`users`) company ke `employee` table se linked nahi hai. Asli integration ke time ye map karna hoga (kaun sa AI user = kaun sa company employee).

---

## 8. File reference (kya file kya karti hai)
| File | Kaam |
|---|---|
| `src/server.node.js` | App ko Node par chalata hai + MariaDB/secrets inject karta hai |
| `src/db/mysqlAdapter.js` | MariaDB ko D1 jaisa banata hai (purana code bina change chale) |
| `src/ai/providers/cloudflareRest.js` | Node se Workers AI (REST); key na ho to graceful stub |
| `migrations/mariadb_0001_ai_columns.sql` | Company tables me AI columns add |
| `migrations/mariadb_0002_ai_extra_tables.sql` | 2 AI-extra tables (project_tasks, ai_feedback) |
| `company_mariadb_schema.sql` | Sirf 24 tables ka structure (bina data) |
| `compnay_schema_Data_.sql` | Company ke 24 tables + asli data |

---

**Run karne ka 1-line reminder:** XAMPP MySQL start → `cd Backend` → `npm run dev:node` → http://localhost:8787
