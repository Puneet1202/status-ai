# 📋 Changes README — 2026-06-19

Aaj 2 kaam hue:
- **A. HR backdated entry** — "/" calendar se HR previous date ka status enter kar sake.
- **B. Final company app me AI integrate** — sir wali nayi `final-project` website me chatbot jodna.

Sab change **surgical** hai (purana working flow kuch nahi toota). Niche **kisko kya dekhna hai** repo + file ke hisaab se likha hai.

---

## 🗂️ Repos (3)

| Repo | Path | Role |
|---|---|---|
| **status-ai** (AI backend) | `Desktop\day2\status_app` | Apna AI brain + API (port **8787**). Alag chalta hai. |
| **day2/react-keyss-status** | `Desktop\day2\react-keyss-status` | Purani (rough) company website — early test. Ab target NAHI. |
| **final-project/react-keyss-status** | `Desktop\final-project\react-keyss-status` | **FINAL** company website (sir-built). **Ab yahin AI integrate hua.** Company repo → **NO push**, sirf frontend widget. |

---

# A. HR Backdated Entry ("/" calendar)

**Problem:** HR kisi aur ka status enter kar sakti thi, par **purani date** ka enter karne ka clean tarika nahi tha. AI ko zubaani date batao to wo galti kar sakta tha.

**Solution:** Project `@` picker jaisा hi ek **`/` date calendar**. HR `/` likhe → calendar khule → pichli date pick kare → wo date **pill** ban jaaye → entry usi date pe save. AI ko date guess nahi karni padti.

**Rules:** Sirf HR-jaise role (DB permission `all_employee_attendance` + `enter_status`). Normal employee ko `/` dikhta hi nahi + backend bhi uski date ignore karta hai (double guard). **Future date kabhi nahi.** Self + others dono ke liye.

### Backend changes (status_app)
| File | Kya badla |
|---|---|
| `Backend/src/controllers/timesheet.controller.js` | (1) `getProjects` response me naya flag **`canBackdate`** (= permission check). (2) `aiChatHandler` body se **`selectedDate`** accept → gate (permission + future-block) → `ctx.forcedDate`. |
| `Backend/src/ai/tools/addTimesheet.tool.js` | Date precedence: **`forcedDate || entry_date || today`** (1 line). Baaki add/overlap/overwrite logic untouched. |

### Frontend changes (`AIChatbot.jsx`)
- `canBackdate` state (`/projects` se) → uspe `/` calendar enable.
- `/` type → native `<input type="date" max={today}>` panel (future block).
- Date chunne par 📅 pill + chat body me naya field **`selectedDate`**. Pill pe ✕ → wapas aaj.
- Placeholder hint HR ke liye: "Type '@' for project, '/' for a past date".

---

# B. Final Company App me AI Integrate

**Verify kiya — sab compatible (kuch break nahi hoga):**
- Token secret **same** (`JWT_SECRET=dev-secret-change-me` == AI ka `ACCESS_TOKEN_SECRET`).
- Token payload same (`sub`/`userId` + employeeId/roleId), token key **`auth_token`**.
- DB schema **100% match** (daily_status_entries, projects, project_assignments, tasks, users, employee, role_permissions, permissions).
- Permissions me `all_employee_attendance, enter_status, search_status` maujood.

### Changes
| Repo / File | Kya badla |
|---|---|
| **status_app** `Backend/.env` | `DB_FILE` ab **final app ki DB** pe → `...\final-project\react-keyss-status\data\keyss-status.prod.db`. (Purana day2 path comment me.) Kyun: AI me log → final dashboard pe dikhe (same DB). |
| **final-project** `src/components/AIChatbot.jsx` | Latest widget copy (backdate feature ke saath). |
| **final-project** `src/components/layout/DashboardShell.tsx` | `<AIChatbot apiBaseUrl={AI_BASE_URL} tokenKey="auth_token" />` authenticated return me (har dashboard page, sirf logged-in). `AI_BASE_URL = NEXT_PUBLIC_AI_BASE_URL || localhost:8787`. |

> Frontend dev ke liye: `lucide-react` + Tailwind final app me already hai, `tsconfig` me `allowJs:true` → `.jsx` import safe. **Kuch install nahi karna.**

---

## ▶️ Chalाne ka order (dev)

1. **AI backend:** `status_app/Backend` me → `npm run dev:node`
   (console me **final** DB path print hona chahiye)
2. **Final app:** `final-project/react-keyss-status` me → `npm run dev`
3. **Login** → niche-right ✨ chatbot button.
4. **Test:** chatbot se entry log karo → **final dashboard pe wahi entry dikhe** (same DB confirm).
5. **HR test:** `/` type → calendar → pichli date → pill → time bolo → entry us date pe save.
6. CORS error aaye to AI `.env` me → `ALLOWED_ORIGINS=http://localhost:3000`.

---

## ☁️ Cloudflare deploy (future — abhi nahi)

CF pe AI deploy karoge to stable URL milega (local terminal ki zaroorat nahi). **Catch:** AI ko **same remote D1** se bind karna padega jise final app use kare. Abhi final `wrangler.toml` me `database_id="local-dev-placeholder"` (local-only) → real shared remote D1 banне tak CF pe data share nahi hoga. URL switch ke liye `NEXT_PUBLIC_AI_BASE_URL` env hook already laga hai (code touch nahi karna padega).

---

## ✅ Health-check (CEO demo se pehle ek command)

```
cd status_app/Backend
npm run health      # poora AI verify — 0 LLM cost, DB me kuch likhta nahi
npm test            # 92 unit tests (regression safety)
```

`npm run health` ye batata hai (PASS/FAIL): config + secret, DB schema + real data
(employees/projects/entries counts), 14 tools valid, routing+token classification
(0-token deterministic vs tiny fast-model), aur backdate rule. Abhi **24/24 PASS**.

## 💸 Token kaha lagta hai (CEO ke liye 1-liner)

- **0 token (zyaadatar):** reads (today/yesterday/last month), totals/breakdowns,
  add (project+task+time), my projects/tasks/leaves, filters, greeting routing+chips,
  future-guard. → deterministic SQL, instant + free + no hallucination.
- **Tiny fast model:** sirf greeting ki natural reply line (canned fallback ke saath).
- **Heavy brain (30B):** sirf complex / free-form / ambiguous messages.

---

_Detailed dev log: `AI-INTEGRATION-CHANGES.md` (2026-06-19 ke blocks)._
