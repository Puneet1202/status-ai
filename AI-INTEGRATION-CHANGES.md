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
