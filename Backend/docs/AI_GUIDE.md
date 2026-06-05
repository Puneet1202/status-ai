# AI Guide — kaise kaam karta hai, naya feature kaise add karein, integration

> Ye file isliye hai taaki tum **confident** raho: AI ka logic samajh aaye, naya
> feature (jaise Leave) **bina kuch tode** add kar sako, aur company site mein
> **safely** integrate kar sako. Date: 2026-06-05.

---

## 0. Sabse pehle — golden rules (yaad rakho)

1. **Jo chal raha hai usko mat chhedo.** Timesheet ke 5 tools tested hain.
2. **Naya feature = nayi file.** Purani files ko haath mat lagao.
3. **Pehle backup.** `keyss-status.prod.db.backup-*` already bana hai. Bada change se pehle naya bana lo.
4. **Ek time pe ek feature.** Test karo → tabhi aage badho.

---

## 1. AI ka flow (ek message ka safar)

User message aata hai → `aiChatHandler` ([controllers/timesheet.controller.js](../src/controllers/timesheet.controller.js)) → `aiChat()` ([ai/chat.js](../src/ai/chat.js)) decide karta hai kya karna hai:

```
message
  │
  ├─ "mera naam?"        → get_my_profile     (code, no model)   🟢 pakka
  ├─ "9 to 11 bug fix"   → add_timesheet      (regex parse)      🟢 pakka
  ├─ "show this week"    → get_timesheet      (code date-parse)  🟢 pakka
  ├─ "hi / thanks"       → 8B FAST model      (natural reply)    🟢 reliable
  ├─ "delete last entry" → 70B model + CONFIRM (tool-calling)    🟡 model
  └─ "edit my entry"     → 70B model + CONFIRM (tool-calling)    🟡 model
```

🟢 = code se chalta hai, AI down ho tab bhi chalega.
🟡 = model use hota hai, par **delete/edit se pehle confirm** maangta hai → data safe.

### 2 models (config: [ai/ai-config.js](../src/ai/ai-config.js))
- **70B** (`llama-3.3-70b`) → tough samajh: edit/delete locate karna.
- **8B FAST** (`llama-3.1-8b`) → natural chit-chat, ~1 sec.
- Dono down/slow ho to **canned friendly reply** — app kabhi crash nahi hota.

### Memory
- **Abhi:** ek chat ke **last ~10 message** yaad (`MAX_HISTORY_MESSAGES`). Isliye "9 to 11" + "wahi kaam" connect ho jaata hai.
- **Abhi nahi:** dobara login pe purani baatein yaad nahi (long-term memory = future feature, §5).

---

## 2. Saare tools kahan hain

Har feature ek **alag file**: [src/ai/tools/](../src/ai/tools/)
```
addTimesheet.tool.js     getTimesheet.tool.js     updateTimesheet.tool.js
deleteTimesheet.tool.js  getMyProfile.tool.js     index.js  ← registry
```
`index.js` sabko jodta hai. Har tool exports: `{ name, schema, handler }`.

---

## 3. ⭐ Naya feature kaise add karein (bina kuch tode) — Leave example

> Maan lo "meri kitni chhutti bachi hai" feature chahiye. Sirf **2 step**, koi
> purani file nahi badalti.

### Step 1 — nayi file `src/ai/tools/getLeaveBalance.tool.js`
```js
// Read tool — employee ki leave balance batata hai. prod.db ke real tables se.
const name = "get_leave_balance";

const schema = {
  name,
  description: "Show the logged-in employee's remaining leave balance.",
  parameters: { type: "object", properties: {} }, // identity token se aati hai
};

// ctx = { db, user, employeeId, env, ... }  ← yahi pattern baaki tools jaisa
async function handler(ctx) {
  const { db, employeeId } = ctx;
  if (!employeeId) return { reply: "Aapka employee record link nahi hai." };

  const { results } = await db.prepare(`
      SELECT lc.name AS category,
             elb.allotted_days, elb.taken_days,
             (elb.allotted_days - elb.taken_days) AS remaining
        FROM employee_leave_balances elb
        JOIN leave_categories lc ON lc.id = elb.leave_category_id
       WHERE elb.employee_id = ? AND elb.year = ?
       ORDER BY lc.name`).bind(employeeId, new Date().getFullYear()).all();

  if (!results.length) return { reply: "Koi leave balance record nahi mila." };

  const lines = results.map(r =>
    `• ${r.category}: ${r.remaining} din bachi (${r.taken_days}/${r.allotted_days} li)`);
  return { success: true, action: "GET_LEAVE_BALANCE",
           reply: `Aapki leave balance:\n${lines.join("\n")}` };
}

export default { name, schema, handler };
```

### Step 2 — `src/ai/tools/index.js` mein 2 line jodo
```js
import getLeaveBalance from "./getLeaveBalance.tool.js";          // (1) import
const MODULES = [addTimesheet, getTimesheet, updateTimesheet,
                 deleteTimesheet, getMyProfile, getLeaveBalance];  // (2) list me add
```

**Bas.** `chat.js`, controller, auth — kuch nahi badla. Timesheet waise hi chalega.
Model khud naye tool ko samajh ke call karega. (Chaaho to `chat.js` mein ek
deterministic shortcut bhi add kar sakte ho — optional.)

> Yahi pattern har naye feature ke liye: Leave apply, Holidays, Appraisal status,
> Project info — sab `tables` jo prod.db mein already hain, unse.

---

## 4. Kya change karna SAFE hai, kya RISKY

| Safe ✅ | Risky ⚠️ (test zaroori) |
|---|---|
| Naya `*.tool.js` add karna | `chat.js` ka deterministic add/get logic |
| Reply ke shabd/emoji badalna | `timeParser.js` / `blockExtractor.js` (time parsing) |
| Naya read-only query | Auth / JWT / `employee_id` mapping |
| System prompt tweak ([ai/tools.js](../src/ai/tools.js)) | 2-hour cap / overlap rules (business rule) |

---

## 5. AI ko aur behtar banane ka roadmap (priority + risk)

| # | Improvement | Value | Risk | Note |
|---|---|---|---|---|
| 1 | **Hinglish** time-parsing ("9 se 11 ... 1 se 2 lunch") | High (tum Hinglish likhte ho) | Med | `timeParser.js` mein targeted fix + test |
| 2 | **Long-term memory** (AI purani baat yaad rakhe) | High | Med | naya table + prompt inject |
| 3 | **Naye tools** (leave/holiday/appraisal) | High | Low | §3 pattern, ek-ek karke |
| 4 | **Zyada natural** har reply | Med | Med | zyada model = kam reliable (tradeoff) |
| 5 | **Behtar model** | Med | Low | config mein model badlo, test |

> **Sujhaav:** upar se neeche, **ek-ek karke**. Har feature ke baad test, tabhi agla.
> Report button (`ai_feedback`) se jo galtiyan aati hain unhe dekh ke prompt/test
> sudharo — yahi AI ko "seekhne" jaisa banata hai.

---

## 6. Company website mein integrate — safe plan

1. **Backend ko ALAG API ki tarah rakho.** Company site AI ko bas "call" kare
   (`POST /api/timesheet/ai/chat`). AI ka code site ke andar mat ghusao → kuch tootega nahi.
2. **CORS:** `wrangler.toml` ya env mein `ALLOWED_ORIGINS` mein company ka domain daalo
   (e.g. `https://app.keyss.in`). Localhost already allowed hai.
3. **Secrets:** `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SENDGRID_*` — production
   mein real values (wrangler secrets), `.env`/`.dev.vars` git mein kabhi push mat karo.
4. **DB:** remote Cloudflare D1 mein isi file ka data import (ek baar). Detail:
   [PROD_DB_TO_D1_GUIDE.md](PROD_DB_TO_D1_GUIDE.md) §4.
5. **Pehle staging:** live se pehle ek test URL pe chala ke dekho.
6. **Backup:** integrate se pehle `keyss-status.prod.db` ki copy rakho.

### Integration checklist
- [ ] Backup le liya
- [ ] `ALLOWED_ORIGINS` mein company domain
- [ ] Production secrets set (JWT + SendGrid)
- [ ] Remote D1 mein data + `migrations/0005` applied
- [ ] Staging pe login + AI test pass
- [ ] Tabhi live

---

## 7. Roz chalane ke commands (yaad ke liye)

```powershell
# Backend (single file keyss-status.prod.db)
cd backend
npm run dev:node          # → http://localhost:8787 ; OTP terminal me print

# Frontend
cd Frontend
npm run dev               # → http://localhost:5173
```
Related: [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md) · [PROD_DB_TO_D1_GUIDE.md](PROD_DB_TO_D1_GUIDE.md)
