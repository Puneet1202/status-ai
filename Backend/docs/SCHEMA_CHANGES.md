# keyss-status.prod.db — Schema Changes (honest, exact)

> Yeh file batati hai ki `keyss-status.prod.db` mein **kya add/change hua** aur
> **kya bilkul nahi chheda gaya**. Date: 2026-06-05.

---

## TL;DR (Hinglish)

- **DB schema mein sirf 1 change:** ek **naya table `ai_feedback`** add hua.
- **Koi purana table / column / data NAHI badla.** Saara original data jaisa tha waisa hai.
- Baaki sab kaam **code** mein hua (queries ko prod schema pe align kiya) — DB structure pe koi asar nahi.

---

## 1. DB mein kya ADD hua (sirf yeh)

### Naya table: `ai_feedback`
Kyun: chatbot ke **"Report"** button ka data (jab AI galat jawab de) yahan save hota
hai. prod.db mein ye table tha hi nahi, isliye banaya. FK `employee(id)` pe hai (baaki
saari tables ki tarah).

```sql
CREATE TABLE ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    note TEXT DEFAULT NULL,
    selected_project TEXT DEFAULT NULL,
    messages TEXT NOT NULL,
    transcript TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE
);
CREATE INDEX idx_ai_feedback_employee ON ai_feedback (employee_id, created_at);
```

Source file: [`migrations/0005_ai_feedback_prod.sql`](../migrations/0005_ai_feedback_prod.sql)

**Tables: 33 → 34.** Bas itna farak.

---

## 2. Kya bilkul NAHI badla (guarantee)

- ❌ Koi existing table delete/rename nahi hui.
- ❌ Kisi table mein column add/remove/rename nahi hua.
- ❌ Kisi bhi row ka data change nahi hua.
- ✅ Verified row counts (original = ab):

| Table | Rows |
|---|---:|
| users | 281 |
| employee | 214 |
| roles | 5 |
| clients | 67 |
| projects | 113 |
| project_assignments | 88 |
| daily_status_entries | 288443 |
| appraisals | 218 |
| tasks | 0 |
| otps | 0 (test codes clean kiye) |
| ai_feedback | 0 (naya, khaali) |

> Ek chhoti technical baat: file ka `journal_mode` ab `DELETE` hai (WAL nahi). Yeh
> sirf SQLite ka likhne ka tareeka hai — **data ya structure pe koi asar nahi**.
> Isse SQLite viewer mein saara data ek hi file mein theek dikhता hai.

---

## 3. Remote / production pe yahi change kaise lagega

Jab Cloudflare pe deploy karoge, wahan ke single D1 mein bhi yeh ek table chahiye hoga:

```powershell
npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0005_ai_feedback_prod.sql
```

Bas. Baaki kuch nahi.

---

## 4. (Reference) Code mein kya badla — DB pe asar NAHI

Yeh sirf jaankari ke liye — schema/data se koi lena-dena nahi. Queries ko prod.db ke
schema pe align kiya gaya:

- **Auth:** password login hata kar **email-OTP** (prod ke `otps` table se). JWT ab
  `employee_id` bhi carry karta hai.
- **Identity:** naam `employee.name` se, role `roles.name` se (JOIN).
- **Timesheet:** sab queries `employee_id` (= `employee.id`) pe, `users.id` pe nahi.
- **Task column:** `task_name` ki jagah `task_id` (FK→`tasks`); `project_tasks` ki
  jagah real `tasks` table.
- **AI project auto-create:** band (kyunki `projects.client_id` NOT NULL).

Detail blueprint: [`docs/PROD_DB_TO_D1_GUIDE.md`](PROD_DB_TO_D1_GUIDE.md)
