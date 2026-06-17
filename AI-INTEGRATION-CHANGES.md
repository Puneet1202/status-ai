# 🔌 AI ↔ Sir ki Website — Integration Notes

## ⚠️ FOLLOW-UP — Employee role ki permissions (prod DB quirk)
Prod DB me **'employee' role ke paas sirf `add_employee` permission hai** (na
`enter_status`, na `search_status`). Isliye permission-fix ke baad employee ko form
submit + task dropdown pe 403 aata tha. **Fix (sir ke project me
`permissions.config.ts`):** `enterStatus` + `checkStatus` ko `OPEN_PERMISSIONS` me
daala — ab har logged-in employee apna status log/dekh sakta hai. Data scoping service
khud karti hai (create → own employeeId; search → applyRoleScope employee ko apne data
tak rokta hai), to safe hai. **Behtar (sir ke liye): DB me employee role ko sahi
permissions seed karna.**

---


## 🆕 FEATURE — HR/Admin AI se kisi bhi employee ka data dekh sake (role-aware)
Files: `src/controllers/timesheet.controller.js`, `src/ai/chat.js`,
`src/ai/brainRouter.js`, `src/ai/tools/index.js`.
- **FULLY DB-DRIVEN:** "org-viewer" code me hardcode nahi — controller user ki real
  DB permissions padhta hai; agar `search_status` (ya `all_employee_attendance`)
  permission ho to wo org-viewer. Sir DB me kisi role ko ye de/le → AI khud adapt
  karega, code chhuye bina.
- **Org-viewer** read tools (status/query/analyze) me kisi aur employee ka
  **naam** de sakte hai → AI us employee ka data dikhata hai.
- Naam na batayein to AI khud poochhta hai: *"Aapko apni chahiye ya kisi aur ki?"*
- "apni/mera/my" bole → normal employee ki tarah apna data.
- **Security:** normal employee ko `employee_name` param dikhta hi nahi + dispatch me
  role dobara check hota hai → employee KABHI kisi aur ka data nahi dekh sakta.
  Add/edit/delete hamesha apne hi entries pe (kisi aur ke nahi).

---


> Ye file batati hai: **kya-kya change kiya**, **kaise connect karna hai**, aur
> **AI ka code kahan rahega**. Sir ke project (`react-keyss-status`) me abhi tak
> KUCH change nahi kiya — sirf padha. Saare changes IS project (`status_app`) me hain.

---

## 🧠 Sabse pehle: AI ka code kahan rahega?

**AI backend apni jagah ALAG hi rahega.** Use sir ke project ke andar daalne ki
zaroorat NAHI.

| Cheez | Folder | Kaise chalta |
|---|---|---|
| **AI backend** (brain + API) | `status_app\backend` | `npm run dev:node` → `http://localhost:8787` (alag terminal) |
| **Sir ki website** | `react-keyss-status` | `npm run dev` → `http://localhost:3000` (alag terminal) |
| **Chatbot widget** (sirf 1 file) | sir ke project me copy hogi | niche STEP dekho |

Dono alag server chalenge. Connection sirf **widget + token + URL** se hota hai.

---

## ✅ Changes jo IS project (`status_app`) me kiye (sir ka code safe)

### 1. `backend\.env` — JWT secret match kiya
- **Pehle:** `ACCESS_TOKEN_SECRET=bd94cb0b...` (alag value)
- **Ab:** `ACCESS_TOKEN_SECRET=dev-secret-change-me`
- **Kyun:** Sir ka login token isi secret se signed hota hai (`react-keyss-status\.env` → `JWT_SECRET=dev-secret-change-me`). AI ko sir ka token verify karne ke liye **same secret** chahiye.
- **Production:** sir ka asli `JWT_SECRET` yahan daalna.

### 2. `backend\.env` — DB ko sir wali SAME file pe point kiya
- **Add kiya:** `DB_FILE=C:\Users\Puneet Kumar\Desktop\day2\react-keyss-status\data\keyss-status.prod.db`
- **Kyun:** Pehle AI apni alag copy (`backend\keyss-status.prod.db`) padhta tha. Ab AI aur sir ka dashboard **EK hi DB** dekhenge — AI me log kiya to sir ke dashboard pe turant dikhega.
- **Hatana ho:** ye line hata do → AI wapas apni local file use karega.

### 3. `backend\src\middlewares\auth.middleware.js` — token compatibility
- **Kya badla:** Token verify karne ke baad ab AI token se **sirf user `id`** leta hai, aur poori pehchaan (role, employee_id, naam) **shared DB** se nikaalta hai.
- **Kyun zaroori tha:** Sir ka token aur AI ka format alag hai —
  | Cheez | Sir ka token | AI maangta hai |
  |---|---|---|
  | Employee | `employeeId` (camelCase) | `employee_id` (snake_case) |
  | Client | `clientId` | `client_id` |
  | Role | `roleId` = number (4) | `role` = string ("employee") |
  | User id | `sub` / `userId` | `id` |
  - DB se resolve karne se ye saare farak **apne aap** theek ho jaate hain, aur sir ka token bilkul AI ke apne login jaisa behave karta hai.
- **Bonus:** cookie `auth_token` se bhi token padh leta hai (header ke alawa).

---

## 🔗 Ab CONNECT kaise karna hai (sir ke project me)

> Sir ke project me sirf **1 file copy** + **1 line render** + (zaroorat ho to) CORS. Bas.

### STEP A — Widget file copy karo
`status_app\Frontend\src\components\AIChatbot.jsx`
→ copy karke yahan paste:
`react-keyss-status\src\components\AIChatbot.jsx`

> `lucide-react` sir ke project me pehle se installed hai (package.json me hai),
> Tailwind bhi hai — to kuch extra install nahi karna.

### STEP B — Widget render karo (ek line)
Best jagah: **`react-keyss-status\src\app\(dashboard)\layout.tsx`**
(isse har logged-in page pe chatbot dikhega.)

Us file ke layout JSX ke andar, closing tag se thoda pehle, ye add karo:

```tsx
import AIChatbot from "@/components/AIChatbot";

// ... layout ke return ( ... ) ke andar, sabse aakhir me:
<AIChatbot apiBaseUrl="http://localhost:8787" tokenKey="auth_token" />
```

**Do prop important hain:**
- `apiBaseUrl="http://localhost:8787"` → aapka AI backend ka URL.
- `tokenKey="auth_token"` → sir ki website token ko `localStorage` me isi key se rakhti hai. (Widget khud yahin se token utha lega — koi aur change nahi.)

### STEP C — CORS (sirf agar error aaye)
AI backend localhost ko by-default allow karta hai, to dev me kuch nahi karna.
Agar browser CORS error de, to `backend\.env` me:
```
ALLOWED_ORIGINS=http://localhost:3000
```

---

## ▶️ Chalाne ka order (dev)

1. **AI backend:** `status_app\backend` me → `npm run dev:node`
   Console me dikhe:
   ```
   DB: C:\...\react-keyss-status\data\keyss-status.prod.db
   ```
2. **Sir ki website:** `react-keyss-status` me → `npm run dev`
3. Website pe **login** karo (OTP). Phir niche-right corner pe ✨ chatbot button.
4. Chatbot kholo → "@" type karke project chuno → kaam log karo.

---

## 🧪 Sahi chal raha hai? (quick check)
- Chatbot khulta hai, 401 nahi aata → token verify ho gaya ✅
- "@" pe project list aati hai → DB connected ✅
- Kuch log karo → sir ke dashboard / check-status pe wahi entry dikhe → SAME DB ✅

## 🆘 Dikkat aaye to
| Problem | Wajah / Fix |
|---|---|
| Chatbot pe **401** | `ACCESS_TOKEN_SECRET` ≠ sir ka `JWT_SECRET`. Dono `dev-secret-change-me` karo. |
| **CORS error** | `ALLOWED_ORIGINS=http://localhost:3000` daalo. |
| Project list **khaali** | AI galat DB pe hai — `DB_FILE` ka path check karo. |
| Entry sir ke dashboard pe **nahi dikhti** | Dono alag DB file pe hain — `DB_FILE` sir wali file pe point hona chahiye. |

---

---

## 🆕 Session update — 2026-06-12 (chatbot UX + reliability)

Ye saare changes `Backend/src/ai/*` aur `Backend/src/controllers/timesheet.controller.js` me hain.
Sab **universal** hain (employee/HR/admin/superadmin sabke liye same); privilege sirf DB permission se decide hoti hai.

1. **AM/PM puchhna (sirf jab confuse ho):** bare `4 to 5` jaise (1–7 ghanta, bina am/pm) time pe AI `🌅 AM` / `🌆 PM` chips deta hai. Clear time (`18:00`, `6pm`, `04 to 05`, `9-11`) → seedha save. `chat.js` me `ambiguousAmPm()`.
2. **Hamesha English reply:** AI input koi bhi bhasha (Hindi/Hinglish) samajhta hai par jawab **sirf English** me. Saare deterministic replies English + `brainRouter.js`/`tools.js` prompt me "always English" directive. (Pehle `brainRouter` "match user's language" kehta tha — wahi root cause tha.)
3. **`get_my_permissions` professional:** markdown `**` hata diya (UI literal `**` dikhata tha), dashboard permissions ko NAAM se nahi sirf **count** se dikhaya, baseline line (apne hours + profile). `enter_status` sub-menu me "Log for a team member" sirf org-viewer (`all_employee_attendance`) ko — plain employee ko nahi.
4. **`get_my_profile`:** `**` hata; ab **designation + joining date** bhi (DB se, sirf apna).
5. **Self-overlap bug fix:** ek hi time-block jo description me "and"/"&" se 2 ban jaata tha (e.g. `11-12 ai testing and bug fix`) → ab same start+end blocks **merge** hote hain; bogus "11:00–12:00 overlaps 11:00–12:00" nahi.
6. **Time + project selected → seedha log:** model "what did you work on?" nahi poochhega jab task already selected ho (`chat.js` brain fall-through).
7. **"Log my hours" message professional:** @ project + task select + 2-hour/block rule, valid example (deterministic, model nahi).
8. **Edit window (post-save):** `add_timesheet_entries` ab saved entries ki **id + time + project + tasks** return karta hai → frontend "✏️ Edit" button deta hai.
9. **Whole-day EDIT = replace:** frontend `replaceEntryIds` bhejta hai → controller un rows ko **delete** karke edited blocks **dobara save** karta hai (same project/task). Guard: message me time na ho to kuch delete nahi (accidental wipe se bachav).
10. **Update locator am/pm-tolerant:** `update_timesheet` start-time ko `09:00` ya `21:00` dono se match karta hai (model misread se bachav) + `brainRouter` ko "time = locator" guidance.
11. **`getProjects` add-for-others scope:** HR/Admin "Viewing: X" ke saath `@`-project picker khole to **X ke** assigned projects aate hain (apne nahi). Gate: `all_employee_attendance` + `enter_status`. Normal employee → apne hi (security).

> Rate-limit (info, koi change nahi): AI chat per-user **20/min** (env `AI_RATE_PER_MIN`, default 20) — `timesheet.controller.js` `aiRateLimitOk()`. In-memory 60s sliding window + optional Cloudflare limiter.

_Note: `Backend/keyss-status.prod.db` (binary) commit me shaamil nahi — woh data hai, code nahi._

---

## 🆕 Session update — 2026-06-17 (Cloudflare AI, token-saving, personal-info tools, format)

Saare changes `backend/src/ai/*`, `backend/src/controllers/timesheet.controller.js`, `backend/src/server.node.js`, `backend/.env` me. Frontend (company repo) ke 2 chhote fixes alag se neeche.

### A. Models & config (sab env-driven)
1. **Deprecated fast-model fix:** `@cf/meta/llama-3.1-8b-instruct` (CF ne 2026-05-30 ko deprecate kiya, "hey" pe REST 410) → **`@cf/meta/llama-3.2-3b-instruct`**.
2. **Models env-driven (ek knob):** `AI_MODELS=1|2|3` se code khud adjust — `3`=BRAIN+CHAT+FAST alag, `2`=BRAIN(+CHAT)+FAST, `1`=ek model sab. Optional override: `AI_CF_MODEL`, `AI_FAST_MODEL`. `ai-config.js` me `getChatModel()/getFastModel()/modelCount()`. Current = **2 model** (heavy brain + chhota fast).
3. **`.env` saaf + professional** (sections, short comments). **Loader fix** (`server.node.js`): ab inline `# comment` strip hota hai (pehle comment model-name me ghus ke "No such model" deta tha).
4. **Boot banner:** BRAIN + CHAT + FAST + `MODELS: N` print (sirf utne model jitne chal rahe).
5. **Dead code hata:** `features/embedding.js` (unused, supabase) + `EMBEDDING_MODEL`.

### B. Token-saving + speed (deterministic-first, brain skip)
6. **Tool-saver:** har message pe sirf **relevant tools** ki schema bheji jaati hai (clear single intent → narrow; ambiguous → full set). ~2800 input-token ka tool-JSON bachta hai. `brainRouter.js` `relevantToolNames()`. Accuracy safe (fallback = full).
7. **Deterministic-first routing (0 token, instant, no 12s brain wait)** — clear queries brain se PEHLE settle: **analytics breakdowns**, **reads** (today/yesterday/last month/month-name/date-range), **filters** (keyword/time-of-day/duration), **my-projects/tasks/leaves**. Leaderboard/compare + ambiguous + logs/edits → brain (jaisa tha).
8. **Per-message TRACE box** (`trace.js`): har message ke baad route + brain-call count + tool count + tokens print.

### C. Date/period + filter (comprehensive)
9. **Month NAME support:** `June`, `March 2026`, `feb ka data` → us mahine ki range. (`parseGetRange`)
10. **`march 2026` fix:** pehle pura saal ka total deta tha (bare-year analytics) → ab MARCH read. Bare year ANALYTICS_INTENT se hata; `parseAnalyticsRange` month ko year se pehle.
11. **ISO date-range bug fix** (`looksLikeTimeBlock`): `2026-05-01 to 2026-05-31` ko "01 to 2026" time-block samajhta tha → ISO dates strip. (date-range chips/queries ab deterministic + free).
12. **Bina-date filter → ALL-TIME** (pehle sirf "today" → khaali). `query_timesheet`.
13. **Weak-filter guard:** lambi day-narrative (jisme "chatbot/tasks" jaise shabd ho) ab **filter (search) nahi** banti — log path pe jaati hai. Sirf chhota (≤8 word) ya read-verb se shuru → filter.
14. **Future guard:** `tomorrow`/`next week` → friendly "future ka nahi hai" (deterministic).

### D. Chips / UX
15. **Breakdown follow-up chips** (analyze total ke neeche `By project/month/day`), **month drill-down chips** (`By month` → har month tap → us month ke din), **pagination** (`⤵️ Show next N`) — sab deterministic (0 token).
16. **Greeting quick-action chips** (`hey` → `Add entry / Find entry / Total hours / Last month`). **Add-help** (format + 2-hour rule) aur **Find-help** (filter examples) — deterministic.
17. **Filter results** ke neeche suggestion chips; **empty filter** → "kaise add karein" guidance.

### E. Professional format (entry lists + filters)
18. **Grouped by day** (📅 date heading + us din ki time-ranges), **chronological** (mahine ki starting se, no reverse), HH:MM (no seconds), description clip, clean total. `getTimesheet.tool.js` + `queryTimesheet.tool.js`.

### F. Naye PERSONAL-INFO tools (sab self-scoped / role-safe)
> Sab `ctx.employeeId` (JWT) pe hard-scoped — koi `employee_name`/`employee_id` param kaam nahi karta (injection test pass). READ_SCOPED_TOOLS me NAHI → "doosre ko dekho" path inpe nahi lagta. Sirf apna data, kabhi kisi aur ka nahi.
19. **`get_my_projects`** — assigned projects (count + list). "how many projects i assign", "my projects".
20. **`get_my_tasks`** — assigned tasks (status-wise). **Multi-project picker:** multiple projects ho to per-project count + project chips → tap → us project ke tasks (exact match). Status filter (todo/in progress/done).
21. **`get_my_leaves`** — balance (allotted/taken/remaining per category) + applications. Modes: **status** (pending/approved/rejected), **period** ("last month leave li thi", "on 2026-05-12" → leave ya present), **all-time** ("since joining / ab tak kitni leave li" → total approved). Clear empty-state message.
> Attendance = `analyze_timesheet` (by day) se kaafi cover.

### G. Parsing fix
22. **Multi-line description** (`timeParser.js`): time ek line + description agli line(s) pe → ab poora block description capture hota hai (newline→space, next-time tak). Pehle khaali ho ke history se galat text ("How do i add an entry") bhar jata tha.

### Frontend (company repo `react-keyss-status/src/components/AIChatbot.jsx`) — manually push
- **ISO date strip** guard me: `entries from 2026-05-01 to 2026-05-31` pe "Select a project first" toast nahi aata.
- **Log = time RANGE** (do time, `9-11`/`9 to 11`); single time (`before 10am`, `between 9am and 12pm`) = FILTER, project nahi maangta.

> Rate-limit unchanged: per-user **20/min** (env `AI_RATE_PER_MIN`). Sab tools deterministic SQL → data hamesha DB ke barabar (no hallucination).

---

## 🆕 Session update — 2026-06-17 (overlap-overwrite, 0-token add, dynamic filter, typo-tolerance)

Saare changes `backend/src/ai/chat.js`, `backend/src/ai/timeParser.js`,
`backend/src/ai/tools/{addTimesheet,getTimesheet,queryTimesheet,index}.js`,
`backend/src/controllers/timesheet.controller.js` me. Frontend (company repo) ke fixes neeche alag.

### A. Overlap → OVERWRITE (reject nahi)
1. **Naya time existing entry se clash kare to reject nahi** — ab **"✅ Yes, update existing / ✖ No"** chips aate hain. Yes → purani row delete + nayi save (`executeOverwrite`). No → existing safe + "View today's entries" chip. (`addTimesheet.tool.js`, `timesheet.controller.js`)
2. **Clash message me EXISTING entry ka asli description** dikhता hai (naye block ka nahi) — warna galat task naam dikhता tha.
3. **Add-for-others overwrite fix (security):** HR "Viewing: Puneet" ka overwrite ab **Puneet** ke account pe hota hai (pehle galti se HR ke apne pe ho jaata tha). `pendingAction.employee_id` carry hota hai; controller permission re-check karta hai (org-viewer + enter_status) — normal employee dusre ki id inject nahi kar sakta.

### B. 0-token ADD fast-path
4. **Project + task + time teeno selected → seedha save, LLM call nahi** (`chat.js`). Description me koi bhi word (leave/filter/show) ho — hijack nahi karta; ye check leave/filter/read detectors se PEHLE chalta hai. Edit/delete intent ya read-verb (show/list) ho to skip → brain.
5. **No-time nudge:** project+task selected par time nahi diya → LLM ko bheje bina deterministic reply "bas time chahiye" + **time-slot chips** (`9 AM–11 AM` … `4 PM–6 PM`). Chips **hamesha** dikhte hain — bhara slot tap karoge to overwrite-confirm aa jaata hai. (`timesheet.controller.js`)

### C. Dynamic filter + naye deterministic routes (0 token)
6. **Dynamic keyword filter:** hardcoded list ke alawa ab **koi bhi search term** free-text se nikalta hai ("about onboarding", "interview tasks", "priyanka wala kaam") → `query_timesheet` LIKE. Sabse distinctive word uthata hai. (`chat.js parseFilters`)
7. **`at/from 9 to 11`** → time-window read filter (us window ki entries).
8. **"current/today's status"** → aaj ki entries (typo-tolerant `st+a+tus`).
9. **"total hours / how much hours / kitne ghante"** → analyze total (last-5 dump nahi).
10. **Attendance** ab `attandance` (a/e galti) bhi pakadta hai.
11. **HR employee connect:** `connect with <naam>` / bare naam (org-viewer) → us employee se connect + sticky "Viewing" pill. Galat naam → professional "no such employee". Same naam → pick-list.

### D. Typo-tolerance + format robustness
12. **Fuzzy command-word corrector** (`chat.js`): non-log message me core words ki 1-letter galti auto-theek ("staatus"→status, "yeaterday"→yesterday, "attendence"→attendance, "entres"→entries). Log messages chhute nahi.
13. **Typo-tolerant greeting** (`hlo`/`hlw`/`hloooo`/`hlww`/`helo`) → ab consistent quick-start chips + 0 token (pehle brain pe jaate the, kabhi chips kabhi nahi).
14. **Glued time-range** (`9to11`, `(9to11)`, `9se11`) — `looksLikeTimeBlock` ab pakadta hai; AM/PM disambiguation numeric dates (`3-06-2026`) ko ignore karta hai (pehle "3 to 6" samajh ke AM/PM puchta tha).
15. **Description cleaner** (`timeParser.js`): bracket/paren format `(9to11)`/`[9 to 11]` me leading/trailing `)`/`]` description se hata.
16. **Verbatim save rule:** time-only turn ("9 to 11") thin description ho to user ke **turant pichle message** se literal text uthata hai (gibberish bhi). Read/command query se borrow NAHI karta (pehle "show my entries" → "Show my entries for" galat save hota tha).

### E. Token-saving
17. **Full descriptions:** read/filter list me 70-char truncation hata — poora task text dikhता hai (`getTimesheet.tool.js`, `queryTimesheet.tool.js`).
18. **History trim:** model ko bheji jaane wali history me badi assistant replies (>400 char) summary se replace — input tokens kam, UI me full dikhता hai (`chat.js buildSlidingWindow`).

### Frontend (company repo `react-keyss-status/src/components/AIChatbot.jsx`) — manually push
- **Copy button** har message ke neeche (user + AI) — tap → poora text clipboard, "Copied!" feedback (clipboard API + textarea fallback).
- **Glued time-range** (`9to11`/`(9to11)`) ab log detect hota hai → project guard fire.
- **Read-veto START-anchored:** log ki description me `first`/`analyzed`/`before` jaise word ab use "search" nahi banate — sirf message read-verb (show/list/find) se shuru ho to read; warna log → project maangta hai.

> Sab universal (employee/HR/admin same); privilege sirf DB permission se. Deterministic-first → zyaadatar queries 0 token; brain sirf complex/free-form pe.
