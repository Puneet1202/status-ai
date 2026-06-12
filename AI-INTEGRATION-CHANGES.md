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
