# 🔌 AI ↔ Sir ki Website — Integration Notes

## 🐛 FIX (2026-06-22) — Self-echo line re-send: galat "I just need the time" + "Work"/"2.0 hrs)" description
File: `src/ai/timeParser.js`.
- **Symptom:** User bot ki apni formatted output line (`• 09:00 → 11:00 (2.0 hrs) — <desc>`)
  wapas bhejta tha to (a) backend "Project and task are set — I just need the time" puchta
  (time hai phir bhi), aur (b) overwrite ke baad description corrupt — `2.0 hrs) — <desc>`
  ya sirf `Work` save hota.
- **Root cause:** Arrow `→` ko sirf `parseWorkBlocks` " to " me normalize karta tha; `hasWorkTime`
  nahi karta tha → controller ki NO-TIME NUDGE galat fire. Aur `cleanLabel` bot ki apni
  `(N hrs) — ` decoration strip nahi karta tha → wahi text description me ghus jaata.
- **Fix:** (1) Shared `ARROW_RE` const; `hasWorkTime` ab arrows normalize karta hai (parser jaisa).
  (2) `cleanLabel` me self-echo strip — leading `• ` bullet + `(N[.N] hr/hrs) —` exact bot-format tag
  hata deta hai, taaki re-sent line apni ASLI description rakhe. Bot-format-exact pattern → real
  user text (`2 hrs of meeting prep`) pe koi false-strip nahi. Regression tested.

## 🐛 FIX (2026-06-22) — "2 to 4pm" se 14-ghante ka galat block
File: `src/ai/timeParser.js` (work-range resolution loop).
- **Symptom:** `2 to 4pm` → `02:00–16:00` (14 hrs!) save hota. Bare start ko AM aur PM-end ko
  PM resolve kar raha tha. (`3 to 5pm`, `1 to 3pm`, `4 to 6pm` sab affected.)
- **Fix:** MERIDIEM-INHERIT rule — bare start + explicit PM end → start ko bhi PM lift karo,
  jab tak `pmStart < end` rahe (aur pichle block se aage). `11 to 1pm` safe (→ 11:00–13:00,
  lift nahi hota). Stress-test: 14/14 cases pass. `2pm to 4`, `9 to 11am`, `10 to 12pm` sab intact.

## 🐛 FIX (2026-06-22) — "edit my last log" / "update the 9-11 entry" UPDATE pe route nahi hota tha
File: `src/ai/chat.js` (`UPDATE_INTENT`).
- **Symptom:** `update the 9-11 entry to 10-12` aur `edit my last log` UPDATE ki jagah casual chat
  me chale jaate the (verb+noun ke beech sirf 1 filler word allow tha; yaha 2 the).
- **Fix:** verb→noun gap `(?:the |my |...)?` se badalkar `(?:\S+\s+){0,3}?` (non-greedy, max 3 words).
  True-positive ab match; false-positive safe — `update the readme docs`, `update you about the
  dashboard later`, `9-10 fix the ui bugs` UPDATE NAHI bante (tested). Full intent suite 18/18 pass.

## 🐛 FIX (2026-06-22) — "employee id" ko AI naam samajh leta tha ("no employee named id")
File: `src/controllers/timesheet.controller.js` (FIELD-WORD GUARD).
- **Symptom:** HR `employee id` likhe to model `get_employee_info(employee_name:"id")` bana deta
  → "no active employee named 'id'". Apna ID dekhne ke liye `show my employee id` likhna padta tha.
- **Fix:** FIELD-WORD GUARD — `employee_name` agar field-word ho (`id/name/profile/details/email/
  mobile/designation/...`) to use strip kar do. Phir query selected/viewed employee par (aur kuch
  select na ho to SELF par) girti hai → HR ko apna profile (incl Employee ID) seedha milta hai,
  bina "my" likhe. Real names (madhulika/puneet/...) untouched. Behavior model: koi naam/Viewing-pill
  nahi → apna data; naam ya pill ho → us employee ka; pill active hote hue apna chahiye → "my/apna".

## 🆕 FEATURE (2026-06-22) — MCP server (local stdio) · existing tools ko Claude Desktop pe expose
Naya folder: `backend/mcp/` (`server.mjs` + `README.md`). Existing backend untouched.
- **Kya:** 14 AI tools (add/query/analyze timesheet, leaves, projects, tasks, profile...)
  ko MCP par expose karta hai → Claude Desktop se seedha "log 9-11 api work" / "show my hours".
  Host LLM reasoning/voice/multilanguage karta hai → Cloudflare AI quota bachta hai.
- **Reuse-only:** `REGISTRY` + `dispatchTool` wrap kiye; koi tool-logic dubara nahi likha.
- **Auth:** user JWT `MCP_AUTH_TOKEN` (same company token). Middleware wali EXACT chain —
  verify → DB se user → role_permissions → perms/isOrgViewer → ctx → dispatchTool.
- **Verified:** tools/list = 14 ✅; `get_my_profile` real DB data (Vijay #135) ✅;
  scope security ✅ (employee #135 ne madhulika dekhne ki koshish → "Only HR/Admin" deny).
  MCP backend auth ko bypass NAHI karta — usi se guzarta hai.
- **Dep:** `@modelcontextprotocol/sdk`. Script: `npm run mcp`.
- **Pending:** remote MCP (Cloudflare Workers) for ChatGPT/public; "Generate API key" UI
  (long-lived per-user token) sir ke app me — abhi JWT copy-paste se test.

## 🆕 IMPROVEMENT (2026-06-22) — get_my_leaves me category filter
File: `src/ai/tools/getMyLeaves.tool.js`.
- **Pehle:** "earned leaves" poochho ya kuch bhi, saari categories (Casual/Earned/Medical) dikhti.
- **Ab:** optional `category` param — naam diya ("earned") → sirf wahi (single line, Total skip);
  na diya → sab + Total (pehle jaisा). Galat naam → saaf "No <x> leave balance found" message.
  Partial case-insensitive match; recent apps bhi usi category ke. Self-scoped hi (security same).
- Note: `32345678` Earned value = user-added test data (Anurag 348), tool sahi dikha raha tha.

## 🆕 FEATURE (2026-06-22) — apply_leave tool (AI se leave apply)
Files: `src/ai/tools/applyLeave.tool.js` (naya), `src/ai/tools/index.js` (register).
- **Kya:** user "mujhe leave chahiye / apply 2 days earned leave" bole → PENDING leave application
  ban jaati hai. Host LLM reason ko professional likhta hai; reason na ho to **professional reason
  ke suggestion chips** + date auto-filled. Manual se easy.
- **Self-scoped** (ctx.employeeId) — kisi aur ke liye apply nahi (security same as add_timesheet).
- **Validation (DB-driven):** category resolve; balance (remaining < days → block); max_consecutive
  _days_allowed (Casual=1 etc → block); overlap with pending/approved → block; min_notice + document
  → soft note (phir bhi submit, admin reviews). status='pending'.
- **Verified:** Casual 3-day → block ✅; unknown category → list+chips ✅; no reason → suggestions ✅;
  happy-path INSERT (id 103, pending) ✅ then test row DELETED → company DB clean.
- tools/list ab 16 (15 registry + ping).

## 🆕 FEATURE (2026-06-22) — update_leave tool (edit/cancel pending leave)
Files: `src/ai/tools/updateLeave.tool.js` (naya), `index.js` (register).
- **Kya:** galti se galat date/reason apply ho jaye to fix/withdraw — "change my leave to 27 June",
  "cancel my leave". LATEST pending application pe chalता hai (add-status ke edit jaisा).
- **Self-scoped**; sirf 'pending' editable (approved/rejected nahi). Date change pe wahi validation
  dob= (balance, max-consecutive, overlap — apne aap ko exclude karke). Cancel → status='cancelled'.
- **Verified:** apply→edit(20→27 Dec)→cancel full flow ✅, test rows DELETED, DB clean.
- tools/list ab 17 (16 registry + ping).

---

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

---

## 🆕 Session update — 2026-06-19 (HR backdated entry — "/" calendar)

Problem: HR/Admin kisi aur ka status enter kar sakti thi (add-for-others logic tha),
par **previous date** ka enter karne ka clean logic nahi tha. Agar HR AI ko bol kar
date deti to model date guess me galti kar sakta tha. Fix: project ke `@` picker jaisा
hi ek **`/` date calendar** — HR `/` likhe → calendar khule → pichli date pick kare →
wo date ek pill ban jaaye → entry usi backdate pe save ho (AI ko date guess nahi karni).

Privilege **purely DB-permission se** (org-viewer `all_employee_attendance` + `enter_status`)
— normal employee ko `/` dikhta hi nahi aur backend bhi uski `selectedDate` ignore karta
hai (double guard). **Future date kabhi nahi** (sirf aaj/past). Self + others dono ke liye.

### Backend (`status_app`)
Files: `src/controllers/timesheet.controller.js`, `src/ai/tools/addTimesheet.tool.js`.
1. **`getProjects`** ab response me `canBackdate` flag deta hai (= `all_employee_attendance`
   + `enter_status`). `/projects` mount pe already fetch hota hai → koi naya call nahi.
   (Perms ek baar load → canBackdate + add-for-others viewAs dono reuse karte hai.)
2. **`aiChatHandler`** body se `selectedDate` (YYYY-MM-DD) accept → gate (canBackdate +
   `selectedDate <= today`, future block) → `ctx.forcedDate`. Bina permission/future/
   galat-format → ignore → normal (today/parsed) flow.
3. **`addTimesheet` handler** date precedence: `forcedDate || data.entry_date || today`
   (ek line). forcedDate model-parsed date ko override karta hai → HR ki pick jeet'ti hai.
   Baaki add/overlap/overwrite/edit logic **untouched** — saare add-paths controller ke
   `dispatchTool(...ctx)` se hi execute hote hai, to forcedDate har jagah lagta hai.

### Frontend (company repo `react-keyss-status/src/components/AIChatbot.jsx`) — manually push
- `canBackdate` state (`/projects` se) → uspe `/` calendar enable.
- `handleInputChange`: current word `/` (sirf canBackdate) → native `<input type=date>`
  panel (`max=today`, future block). Date chunne par `selectDate()` → sirf `/` token
  strip + `selectedDate` pill (📅 amber), message text intact (project pill jaisा).
- Chat body me naya field `selectedDate`. Pill pe ✕ → wapas aaj ki date.
- Placeholder hint HR ke liye: "Type '@' for project, '/' for a past date".

> Universal pattern (project `@` jaisा): pill = single source of truth, koi text-inject
> nahi, koi hallucination nahi. Purana flow (today entries, add-for-others) bilkul safe.

---

## 🆕 Session update — 2026-06-19 (FINAL company app me integrate)

Sir ne **final** (properly-built) company app di → `C:\Users\Puneet Kumar\Desktop\
final-project\react-keyss-status`. AI (status-ai) waisा hi alag rehta hai; ismें bas
chatbot widget jodna tha. Verify kiya — sab compatible:
- **Token secret same:** final app `JWT_SECRET=dev-secret-change-me` == AI backend
  `ACCESS_TOKEN_SECRET`. Token payload bhi same (`sub`/`userId` + employeeId/roleId).
- **Token key same:** `localStorage["auth_token"]`.
- **Schema 100% match:** final DB me `daily_status_entries, projects, project_assignments,
  tasks, users, employee, role_permissions, permissions` saare expected columns ke saath.
  Permissions me `all_employee_attendance, enter_status, search_status` maujood → backdate
  + add-for-others gating chalega. Koi tool break nahi.

### Changes
1. **AI backend `.env` (status_app):** `DB_FILE` ab FINAL app ki DB pe →
   `...\final-project\react-keyss-status\data\keyss-status.prod.db` (purana day2 path
   comment me rakha). Kyun: AI me log → FINAL dashboard pe dikhe (same DB).
2. **Final repo frontend (company repo — NO push, local edit):**
   - `src/components/AIChatbot.jsx` — latest widget copy (with `/` backdate feature).
   - `src/components/layout/DashboardShell.tsx` — `<AIChatbot apiBaseUrl={AI_BASE_URL}
     tokenKey="auth_token" />` authenticated return ke andar (har dashboard page, sirf
     logged-in, print me hidden). `AI_BASE_URL = NEXT_PUBLIC_AI_BASE_URL || localhost:8787`
     → CF deploy pe sirf env set karna, code touch nahi.
   - `tsconfig`: `allowJs:true` already → `.jsx` import safe. `lucide-react`+Tailwind already.

### Cloudflare deploy (future, abhi NAHI)
CF pe AI deploy → stable URL (local terminal ki zaroorat nahi). Catch: AI ko **same remote
D1** se bind karna padega jise final app use kare. Abhi final `wrangler.toml` me
`database_id="local-dev-placeholder"` (local-only) → real shared remote D1 banने tak CF
pe data share nahi hoga. Plan: pehle local chalao, production pe shared D1 + CF deploy.

### Chalाne ka order (dev)
1. AI backend: `status_app/Backend` → `npm run dev:node` (console me FINAL DB path dikhe).
2. Final app: `final-project/react-keyss-status` → `npm run dev`.
3. Login → niche-right ✨ chatbot. CORS error aaye to AI `.env` me `ALLOWED_ORIGINS=http://localhost:3000`.

---

## 🆕 Session update — 2026-06-19 (date-picker UX fix + health-check script)

### A. "/" date-picker UX fix (frontend — `AIChatbot.jsx`, final + day2 identical)
1. **Manual type/edit chalta hai ab:** pehle `onChange` har keystroke pe `selectDate`
   call karke panel turant band kar deta tha → user date type nahi kar pata tha. Ab
   input **controlled** (`dateDraft` state) — free type/pick, panel band nahi hota;
   ek **"Apply"** button (ya Enter) pe hi `selectedDate` pill banti hai.
2. **Bahar click → band:** ek invisible **backdrop** (`fixed inset-0 z-20`) — khali
   jagah click pe picker band. Native calendar popup (browser chrome) DOM click nahi
   deta, isliye wo band nahi karta (date pick karte waqt galti se close nahi hota).
3. `autoFocus` + Apply pe future/empty guard (`disabled` jab `dateDraft > today`).

### B. Health-check script (CEO-ready) — `scripts/health-check.mjs` (`npm run health`)
Ek command me poora AI verify (0 LLM cost, DB me kuch likhta NAHI). Sections:
- **CONFIG** — secret set, DB path (final?), model config.
- **DATABASE** — saare zaroori tables/columns + backdate permissions + row counts
  (proves real data: employees=217, projects=113, entries=288502).
- **TOOLS** — 14 tools registry valid (schema + handler).
- **ROUTING & TOKENS** — sample messages classify: **9/11 pure 0-token deterministic**,
  **2/11 greeting = tiny FAST model** (heavy 30B brain = 0). Instrumented stub counter
  se proof (koi real call nahi).
- **BACKDATE RULE** — HR "/" gating (permission + future-block + precedence) logic asserts.
Result: **24/24 PASS**. Existing `npm test` (tests/*.test.mjs) bhi **92/92 PASS** (regression safe).

> Token note (CEO ke liye): zyaadatar queries (reads/analytics/add/personal/filters)
> **0 token** — deterministic SQL routing, instant + free + no hallucination. Heavy
> 30B brain sirf complex/free-form pe. Greeting ka reply chhote FAST model se (canned
> fallback) — routing+chips fir bhi deterministic.

### C. Permission query — ACCESS-phrasing coverage (chat.js)
`get_my_permissions` pehle se **LIVE + DB-dynamic** hai (`ctx.perms` har request pe fresh
DB se → admin DB me permission badle to AGLE message pe AI khud naya jawab; 100%
deterministic, no hallucination). Gap: detector sirf "permission" word pakadta tha,
"access" nahi → "mere paas kya access hai" / "my access" fast-model pe gir jaate the.
**Fix:** ACCESS_PERM regex add (English+Hinglish) — possessive (my/mere/mujhe/apni) YA
query-word (kya/kaun/konsi/kitni) ke saath hi `access/adhikaar`. Narrow rakha → negative
("access the dashboard", "give me access", "9-11 access control") galti se trigger nahi
karte (verify kiya). Ab ye bhi **0-token**.

---

## 🆕 Session update — 2026-06-23 (pending-status routing fix + test cleanup hardening)

### A. Pending-report routing broadened (chat.js — org-viewer deterministic route)
**Symptom (sir-visible):** HR/Admin ke natural phrasings galat tool pe ja ke
**"No records found for <date> to <date>"** de rahe the (jabki 14 log pending the):
- `"pending today"` — "pending" tha par doosra keyword nahi → miss
- `"aaj kisne status nahi bhara"` — "pending" word hi nahi → miss
- `"who has not filled their status today"` — "pending" word nahi → miss
Sirf `"who is pending today"` chal raha tha. Fail hone par brain (qwen) inhe
logs/query tool pe bhej deta tha → misleading "No records found".

**Fix:** deterministic pending route (line ~835) ko 2-tarah trigger kiya:
1. `PENDING_CTX` — "pending" + (status/timesheet/fill/who/kaun/**today/aaj/kal/
   yesterday/week/month/hafte**/nahi bhara) → "pending today" bhi pakda jaye.
2. `NONFILL_PENDING` — "nahi/nhi bhar*" YA "not/haven't/hasn't/didn't … fill/
   submit/status/timesheet" → bina "pending" word ke bhi pending samjhe.
Guards intact + naya **`!\bleaves?\b`** guard (leave query na cheene).
**Verify:** 5/5 pending phrasings ✅ ab `get_pending_status` (0-token deterministic).
Regression ✅ — `"9-11 pending review of report"` log save hua (time-block guard),
`"show my pending leaves"` leave reply (leave guard). Sab still 0-token.

### B. test:roles cleanup hardening (scripts/test-roles.mjs)
Add-pipeline description ka leading `[` strip kar deta hai (`"[AI-TEST]"` →
`"AI-TEST]"`). Cleanup `LIKE '%[AI-TEST]%'` isliye 0 match karta tha → har test run
ke baad 3 junk entries **real DB (final-project) me reh jaati thi** (aaj ki date pe
Puneet/Neha ke timesheet me "AI-TEST]" dikhta). Cleanup ko `LIKE '%AI-TEST%'` kiya
(bracket ke bina). Purani leftover junk rows (291190-192) manually delete ki — DB clean.

### C. Pending route ab DATE-AWARE ("this week"/"this month"/"kal") — chat.js
Pehle pending route hamesha `data:{}` (=today) bhejta tha → `"pending this week"`
bhi sirf aaj dikhata tha. **Fix:** wahi **PROVEN `parseGetRange` helper** reuse kiya
(jo GET queries use karti hai — koi nayi date-math NAHI). Map:
- range (week/month) → tool ko `{from,to}` → range-mode report
- specific non-today din ("kal") → `{date}`
- today / no-period → `{}` (pehle jaisa, koi change nahi)
**Verify:** `"pending this week"` → 2-day range, `"pending this month"` → 23-day,
`"kal kaun pending tha"` → yesterday; today-cases unchanged. Regression ✅ (log save,
leaves, `"show my hours this week"`, profile sab waise hi). **test:roles ab 15/15** (pehle 14/15).

> NOTE (jaan-boojh ke NAHI badla): add-pipeline ka leading `[` strip
> (`timeParser.js` line ~111) **intentional + unit-tested** hai (bot ki apni
> "(9to11)" line dobara bheji jaye to artifact saaf kare). Real user description `[`
> se shuru nahi karta — sirf test marker `[AI-TEST]` pe dikha tha. Risk > benefit →
> chhoda nahi (test cleanup ko bracket-free kar diya, point B).

---

## 🆕 Session update — 2026-06-23 (LEAVE apply/update/cancel — wired up in chatbot)

### Problem
Leave **VIEW** (balance/pending/all-time via `get_my_leaves`) chal raha tha, par
**APPLY / UPDATE / CANCEL** block the — `applyLeave.tool.js` + `updateLeave.tool.js`
LIKHE aur REGISTRY me REGISTERED the, par 3 jagah se disconnect:
1. Stale `OUT_OF_SCOPE_INTENT` guard (chat.js) "apply/cancel leave" pakad ke
   *"I don't manage leave"* canned reply de deta tha (yeh tab ka jab leave-tool tha hi nahi).
2. `BRAIN_TOOLS` (brainRouter) me sirf `get_my_leaves` tha → brain `apply_leave`/
   `update_leave` ko kabhi call nahi kar sakta tha.
3. Koi deterministic route / INTENT_BUCKET nahi.
**DB/permission ka issue NAHI tha** — leave tables + balances ready; apply self-only
(ctx.employeeId), koi permission nahi chahiye (attendance se ALAG).

### Fix (5 surgical edits, koi working feature nahi toota)
**chat.js**
- `getCapabilityReply`: "I don't handle leave" → ab leave capability listed; payroll/
  holiday/approval hi website pe.
- `OUT_OF_SCOPE_INTENT` narrow: ab sirf **payroll / payslip / holiday / approve-reject
  someone's leave** out-of-scope. Apna leave apply/cancel/edit NAHI rok'ta.
- Out-of-scope canned reply updated (ab "leave nahi karta" jhooth nahi).
- **NAYA deterministic LEAVE-WRITE route** (pending route ke baad, GET/analytics se
  PEHLE — taaki date-bearing "apply leave from <d> to <d>" / chips logs pe na jaye):
  - CANCEL → `update_leave {cancel:true}`
  - CHANGE/edit (date/reason, apply nahi) → `update_leave {from_date?,to_date?,reason?}`
  - APPLY → `apply_leave {category?,from_date?,to_date?,reason?}` — category sirf
    "reason:" se pehle dhoonda; dates `parseGetRange` (proven helper) se; missing ho to
    TOOL khud poochta hai (category chips / "need dates" / reason chips). Self-only, 0-token.
  - Guard: time-block ("9-11 leave module testing") = WORK LOG, leave-apply nahi.

**brainRouter.js**
- `BRAIN_TOOLS` me `apply_leave`, `update_leave` add (brain fallback ke liye).
- Naya INTENT_BUCKET: leave/chutti/vacation → leave tools.

### Verify (sab live server pe, test rows baad me DELETE ki — DB clean)
- View ✅ · Apply single+multi ✅ · maxConsec block ✅ · balance block ✅ · overlap
  block ✅ · no-category→chips ✅ · no-reason→chips ✅ · update date ✅ · cancel ✅
- **Security**: "apply leave for neha" → apne (logged-in) liye bani, neha IGNORE
  (self-only by construction) ✅
- Normal **employee** apni leave apply kar paya (permission nahi chahiye) ✅
- Time-block "leave" word = work-log ✅
- **Regression: test:roles 15/15 ALL PASS** (timesheet/pending/attendance untouched).

---

## 🆕 Session update — 2026-06-23 (chatbot "Cancel edit" button — frontend)

### Problem
Saved entry pe **"✏️ Edit"** click karte hi uska text + project/task input me prefill
ho jaata tha (edit mode). Par agar user ko galti se click ho jaaye ya mann badal jaaye,
to cancel karne ka koi clean tareeka nahi tha — sab kuch **manually** mitana padta tha
(text + project pill alag-alag). Sir ne bola ek **Cancel/✕** chahiye jo ek click me
poora edit-mode saaf kar de.

### Fix (frontend — company repo `final-project/react-keyss-status/src/components/AIChatbot.jsx`, UI-local edit · NO push)
1. **Naya state** `editingActive` (`useState(false)`) — track karta hai ki abhi edit-mode on hai ya nahi.
2. **`startEdit`** me `setInputValue(text)` ke baad `setEditingActive(true)` — Edit click → mode ON.
3. **Naya `cancelEdit()`** — ek click me clean slate:
   ```js
   const cancelEdit = () => {
     replaceIdsRef.current = null;     // replace-target hatao (warna submit purani row delete kar deta)
     setEditingActive(false);          // edit-mode off
     setInputValue('');                // prefilled text saaf
     setActiveContext(null);           // project + task pill bhi hata do (clean slate)
     if (inputRef.current) inputRef.current.style.height = 'auto'; // textarea height reset
   };
   ```
4. **`handleSubmit`** me `replaceIdsRef.current = null;` ke baad `if (editingActive) setEditingActive(false);`
   — normal submit ke baad bhi mode apne-aap off (button gayab).
5. **Footer** `justify-end` → `justify-between`: edit-mode me **left** pe chhota lal
   **"✕ Cancel edit"** button (lucide `X`), right pe wahi "Press Enter to submit" hint.
   Mode off ho to button ki jagah khaali (`<span />`) — layout shift nahi.

### Verify
- Edit click → text + project pill prefill, **Cancel edit** button dikhta hai ✅
- Cancel edit → text, edit-mode, **aur project/task pill teeno saaf** ✅
- Normal submit ke baad button apne-aap gayab ✅
- Koi backend/logic change NAHI — purely widget UX (replace-on-edit flow safe). ✅

> Note: ye sirf `final-project` wali copy me kiya (sir wali real app). `day2/react-keyss-status`
> wali copy me mirror karna ho to bata dena — same 5 edits.

---

## 🐛 FIX (2026-06-23) — leave-apply "need dates" follow-up "No records found" deta tha

### Symptom (sir-visible)
`"how to apply leave"` → tool ne `"I need valid dates… tell me the leave date(s)"`
maanga → user ne `"25 june 2026"` likha → reply **"No records found for 2026-06-23
to 2026-06-23"** (galat — leave apply hona chahiye tha).

### Root cause (`chat.js` leave-write route)
Leave route ka entry-guard message me `leave/chutti` word **must** karta tha. Follow-up
`"25 june 2026"` me wo word nahi tha → leave route miss → message GET read route pe
gir ke aaj ki entries dhoondh ke "No records found" de deta. (Category/reason prompts
me **chips** hote hain jo poora context carry karte hain → wo khud recover ho jaate;
sirf **dates** step pe chips nahi hote → wahi toota.)

### Fix (surgical, 2 edits — koi feature nahi toota)
- `LEAVE_DATE_FOLLOWUP` flag: pichla **assistant** reply agar `"I need valid dates"` /
  `"Tell me the leave date"` tha → current message us apply ka continuation maano
  (bhale usme "leave" word na ho).
- Leave route entry-guard me `|| LEAVE_DATE_FOLLOWUP` add; `APPLY_VERB` me bhi follow-up
  include → bare-date message apply path pe jaata hai, `parseGetRange` se date nikal ke.

### Verify
- Follow-up `"25 june 2026"` → `apply_leave {from_date:2026-06-25, to_date:2026-06-25}`
  **0-token** (LLM call nahi), phir tool category chips poochta hai ✅
- **Negative:** bina us follow-up ke bare `"25 june 2026"` → `get_timesheet_logs` (read),
  apply_leave **nahi** — koi read-query regression nahi ✅
- Unit suite **92/92 pass** ✅

---

## 🐛 FIX (2026-06-23) — leave-apply multi-turn (typed, not chips) tootta tha

User chips tap karne ki jagah turn-by-turn TYPE kare to flow 3 jagah tootta tha:

1. **"i need leave from 25 june 2026" → "end date before start"**
   `parseGetRange` me `from` + no `to` = open-from → `to_date = today` (=23 Jun, jo
   start 25 Jun se *pehle*). **Fix:** apply route me **single-day guard** — `to_date`
   missing/`< from_date` ho ya `"single day"/"ek din"` ho → `to_date = from_date`.
   (Asli range `"25 to 28 june"` me `to >= from` → safe.)
2. **"casual leave and single day" → leave VIEW khul jaata tha (apply nahi)**
   Us message me date nahi tha (2 turn pehle diya) + apply-verb nahi → `get_my_leaves`
   pe gir jaata. **Fix:** (a) follow-up detection broaden — TURANT pichla bot reply agar
   koi apply-prompt tha (dates/category/reason/"leave category"/"reason for your leave")
   to current message apply-continuation. (b) **MID-APPLY MERGE** — jo field abhi missing
   hai (date/category) use recent USER messages se newest-first bhar do. Sirf follow-up
   me → fresh apply contaminate nahi. Apply success/abandon hote hi (latest bot reply
   badal jaata) follow-up false → purani view query hijack nahi.
3. **"causal" (typo) category match nahi karti thi** → category miss. **Fix:**
   typo-tolerant `CAT_RE` (`causal/casaul/casuel`, `earn*`, `med*/sick/bimar`) + `toCat`
   stem-normalize → galat-spelling bhi sahi category banti.

**Verify (deterministic, 0-token):** full flow `how to apply → from 25 june → causal +
single day` → `apply_leave {Casual, 2026-06-25}` ✅; range `{Earned, 25→28}` ✅;
submit ke baad "show my leaves" → view (no hijack) ✅; unit suite **92/92** ✅.

> DATA note (code nahi): chat me `Earned: 32345678 left` = `employee_leave_balances` me
> **Anurag (id 348)** ki Earned `allotted_days = 32345678` — testing ka junk number.
> AI sahi dikha raha hai. Theek karna ho to sane value (e.g. 12) set karni hogi —
> company DB hai, isliye user-confirm ke baad hi.

---

## 🆕 FEATURE (2026-06-23) — `ai_chat_logs`: har chat turn save (per-user, future training data)

### Maksad
User ke chat **pattern** collect karna (kaise bolta hai, kya chahta hai, follow-up) →
(1) **per-user personalization** (AI uske style me dhale), (2) routing/typo improvement
data, (3) future fine-tune ka foundation. `ai_feedback` (sirf Report button, employee_id
pe) se ALAG — ye HAR turn save karta hai aur **USER_ID (users.id)** pe key hota hai.

### Step 1 — Schema (`migrations/0006_ai_chat_logs.sql`)
Naya table: `id, user_id (→users.id), session_id, user_message, ai_reply, intent,
route, tool_name, selected_project, tokens, created_at`. **Ek row = ek exchange**
(user + AI) = ek training example. `IF NOT EXISTS` + index. Sirf naya table — koi data
touch nahi. **Local dev DB pe apply + insert/select/delete smoke-test pass.** Company
(`final-project`) DB pe abhi NAHI (user-confirm pending).

### Step 2 — Fire-and-forget logging (`timesheet.controller.js`, `trace.js`, `server.node.js`, `.env`)
- `logAiChat()` helper — dono main return points (action-path + conversational) pe call.
  **Fire-and-forget:** insert try/catch me; table na ho / fail ho to **chup-chaap skip,
  chat KABHI nahi rukti, error nahi dikhta.** Gate: `AI_CHAT_LOG==='1'`.
- `trace.js`: `getLastTrace()` add (traceEnd ab `last` me snapshot rakhta hai) →
  route/tool/tokens us turn ke trace se. **Stale-trace guard:** message-match check
  (chipAction path jaha traceBegin nahi hota, wahan default deterministic/0).
- `server.node.js`: `AI_CHAT_LOG` env map. `.env`: `AI_CHAT_LOG=1` (default on).
- Import OK, **unit suite 92/92 pass** (koi regression nahi).

> NOTE: dev server `DB_FILE` = company `final-project` DB pe point karta hai → logs
> tabhi save honge jab migration 0006 us DB pe bhi chale (abhi sirf local pe hai). Bina
> table → logging chup-chaap skip (by design). Company DB migration = user-confirm ke baad.

### Update — employee_id column (migration 0007)
Logic **user_id pe hi** (jaisa sir ne kaha); `employee_id` sirf EXTRA filter column
(yaad rehta hai → search easy). Nullable. `logAiChat` ab `user.employee_id` bhi save
karta hai. Local + company dono DB pe applied.

### Update — har turn save (sendChat wrapper)
Pehle sirf 2 main return log hote the → confirm/overlap/nudge jaise **early returns
miss** ho rahe the (e.g. overlap pe "No" wala turn save nahi hota tha). `sendChat(payload,
intent)` wrapper banaya jo HAR reply ko log karke bhejta hai → koi turn miss nahi.
intents: `overwrite_declined`, `no_time_nudge`, `delete_timesheet`, `update_timesheet`,
`add_timesheet_entries`, etc. Har turn = ek nayi row (append; add→edit→delete = 3 rows).

---

## 🆕 FEATURE (2026-06-23) — chat-logs ko "production-grade": privacy + retention + 👍👎 feedback

Senior-engineer best-practices add kiye (3 me se; "alag DB / async queue" = scale ka
kaam, abhi chhote project pe NAHI chahiye — jaan-boojh ke skip).

### A. Privacy — sensitive redaction (log se PEHLE)
`redactSensitive()` — `logAiChat` me user_message + ai_reply pe lagta hai:
- email → `[email]`, 10-digit phone → `[phone]`, 12-digit → `[id]`,
  salary/ctc/account/aadhaar/pan ke paas ka number → `[redacted]`.
- **Light** rakha — normal timesheet text (`9 to 11 api work`) untouched (verify kiya) →
  pattern data zinda, PII leak nahi. (Naam reliably mask mushkil + data kharab → uske liye
  access-control + retention + delete-my-data.)

### B. Retention — purani chat auto-delete (`AI_CHAT_RETENTION_DAYS`, default 90)
`purgeOldChatLogs()` — cron ke bina, `logAiChat` se **din me max ek baar** trigger
(`-N days` se purani rows DELETE). `0`/blank = forever. Background, non-blocking.

### C. "Usable data" — per-message 👍/👎 + delete-my-data
- Migration **0008**: `ai_chat_logs` me `feedback` (1/-1/NULL) + `feedback_note` columns
  (+ index). Local + company dono pe applied.
- `logAiChat` ab insert hui row ka **id lautata** hai → `sendChat` use response me
  `chatLogId` ke roop me bhejta hai (frontend us turn pe 👍/👎 laga sake).
- Endpoint (`timesheet.routes.js`, `authMiddleware` + **self-only**):
  - `POST /api/timesheet/ai/chat-feedback` `{logId, value:1|-1|0, note?}` →
    `rateAiChatLog` (UPDATE … WHERE id=? AND user_id=self).

> DESIGN DECISION (user): **user-facing "delete my data" NAHI rakha.** Ye internal
> company tool hai → data company ka; agar har user baar-baar delete kare to training
> data hi na bache. Privacy phir bhi hai: **consent line** + **90-din auto-retention**
> (admin SQL se purge kar sakta). Hard-delete endpoint + frontend button hata diye
> (migration 0008 ke feedback columns rahe; `deleteMyChatLogs` removed).
>
> UI POLISH: delete button hatने ke baad consent line akeli/awkward lag rahi thi →
> centered + chhota 🛡️ `ShieldCheck` icon ke saath subtle note bana diya.

---

## 🐛 FIX (2026-06-23) — "delete all today" sirf 1 entry delete karta tha (bulk delete)

### Symptom
"Delete my all today entry" → AI ne sirf **ek** (latest) entry locate karke delete ki,
saari nahi. Kyunki `delete_timesheet` tool hamesha **LIMIT 1** (ek hi entry) dhoondta tha
— bulk/"all" ka concept hi nahi tha. Brain "all today" ko bhi single delete bana deta.

### Fix
- **`deleteTimesheet.tool.js`**: naye params `delete_all`, `from_date`, `to_date`.
  `delete_all` pe handler scope (date/range diya → us din/range ki, warna SAARI) ki
  entries ka **COUNT + chhoti preview** deta hai aur **ids** pendingAction me capture
  karta (confirm-window me nayi entry galti se delete na ho). `executeDelete` ab
  `ids[]` (bulk, `id IN (…)`) bhi handle karta — single path (matchId) waisa hi.
- **`chat.js`**: deterministic **BULK_DELETE** route — `delete` + (`all/every/sab/saari/
  poora`) + (leave/time-block guard nahi) → `delete_timesheet {delete_all, from?, to?}`
  (scope `parseGetRange` se). Single delete (bina "all") **waise hi brain pe** (unchanged).

### POLICY (user): bulk delete sirf AAJ ki — purani/all-time NAHI
User ke paas purani entries delete karne ki permission nahi → bulk delete **sirf
today** scoped. Tool handler: non-today date (past/future/range) maange to **saaf mana**
("You can only delete today's entries… contact HR/Admin"). Bina date "delete all" → AAJ
hi maano (all-time NAHI). Verify: today bulk → confirm(3) ✅; past date → refuse ✅;
no-date → today ✅.

### Verify (0-token routing)
- "Delete my all today entry" → `{delete_all, today}` ✅ · "saari entries hata do" → today ✅
- "remove everything for 2026-06-20" (past) → **refused** ✅
- "delete the training entry" (single) → brain (unchanged) ✅
- Confirm → `executeDelete` matched ids delete karta, count batata. **92/92 pass.**

---

## 🆕 (2026-06-23) — session_id wiring (conversation grouping)

### E. session_id — conversation grouping (NULL bharne ko + analysis)
`session_id` column ab fill hota hai (pehle hamesha NULL — bura lagta tha). Frontend
(`AIChatbot.jsx`) chatbot ki ek "baithak" pe ek id banata hai (`sess_<base36>`); us
baithak ke SAARE messages same id se judte hain. **"Clear chat"** → `sessionIdRef`
reset → agli baithak ko NAYA id. Backend: `aiChatHandler` body se `sessionId` accept →
`sendChat` → `logAiChat` INSERT (max 60 char). Faayda: `WHERE session_id = ?` se ek
poori conversation ek saath (kitne turn me kaam hua, drop-off, conversation-level
training). **Koi functionality nahi tooti — sirf ek column fill; unit suite 92/92 pass.**
Purani NULL rows NULL hi rahti hain; naye messages me id aata hai. (Column migration
0006 me hi tha → koi nayi migration nahi.)

### Verify
- Controller + routes import OK; redaction sample test pass; **unit suite 92/92** ✅.
- env: `AI_CHAT_RETENTION_DAYS=90` (`.env` + `server.node.js` map).

### D. Frontend wiring (company repo `final-project/.../AIChatbot.jsx` — UI-local, NO push)
- Assistant message object me `chatLogId` + `feedback` (backend response `data.chatLogId`).
- **👍/👎 buttons** har logged AI reply ke neeche (error reply pe nahi): `rateReply()` →
  `POST /ai/chat-feedback {logId,value}`. Same tap dobara = toggle off (value 0). UI
  turant update, fail pe revert. Icons: `ThumbsUp`/`ThumbsDown`.
- **Consent line + "Delete my data"** footer me: "Chats may be stored to improve the
  assistant." + `deleteMyHistory()` → `DELETE /ai/my-chat-logs` (window.confirm ke baad).
- Sirf `final-project` copy me. `day2` copy me mirror karna ho to same edits.
