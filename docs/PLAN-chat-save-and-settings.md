# 📐 PLAN — Chat Save (DB) + AI Settings / Custom Instructions

> Code se PEHLE ka design. Dono feature **additive + surgical** — deterministic routing
> aur existing flow ko touch nahi karte. Pehle padho, fir " banao" bolo.

---

## ⚠️ Pehle ek decision — AI ke naye tables KAHAN banein?

Chat-save + settings ko ek jagah store karna padega. 2 options:

| | A) Shared prod DB me (`ai_*` tables) | B) Alag AI-owned DB |
|---|---|---|
| Kahan | Sir wali `keyss-status.prod.db` | `status_app/Backend/ai-data.db` (naya) |
| Precedent | ✅ `ai_feedback` already isme hai | — |
| Boundary | Sir ki DB me CREATE TABLE (additive, safe — par sir ko bata dena) | Sir ki DB bilkul untouched |
| CF deploy | same D1 binding | 2nd D1 binding chahiye |
| Effort | kam | thoda zyada (alag connection) |

**Recommendation: Option A** (jaise `ai_feedback`). Sirf naye `ai_*` tables add honge — sir ke
kisi table ko haath nahi. **Sir ko ek line bata dena** ("AI ke 2 chhote tables add kar raha hoon,
tere data ko kuch nahi"). Agar sir mana kare → Option B (5 min extra wiring).

---

# FEATURE 1 — Chat save in DB (neev) 🏗️

**Goal:** chat ab sirf `localStorage` me hai (per-user). DB me bhi save → cross-device history,
analytics, aur Feature-2/memory ki base.

### 1.1 Table — `ai_chat_messages`
```sql
-- migrations/0006_ai_chat_messages.sql
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,        -- users.id (har logged-in user ke paas hai)
  employee_id INTEGER,                 -- optional (scoping/analytics)
  role        TEXT NOT NULL,           -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  context     TEXT,                    -- JSON: { selectedProject, viewAs } (chhota)
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_messages (user_id, created_at);
```

### 1.2 Backend (`status_app`)
- **Auto-save (best):** `aiChatHandler` ke andar, reply banne ke BAAD — user message + assistant
  reply dono insert. Frontend ko alag "save" call nahi karna padta.
  - `try/catch` me — save fail ho to chat reply kabhi na ruke (no-regression).
- **Routes** (`timesheet.routes.js`, authMiddleware):
  - `GET  /api/timesheet/ai/chat/history?limit=50` → current user ke recent messages.
  - `DELETE /api/timesheet/ai/chat/history` → clear (widget ka 🗑️ icon isse jude).
- Scope: hamesha `user_id = token.user.id` (apni hi chat, kisi aur ki kabhi nahi).

### 1.3 Frontend (`AIChatbot.jsx` — company repo, local edit)
- Widget open pe `GET history` → messages hydrate (cross-device). localStorage fast-cache rahe,
  DB source-of-truth.
- 🗑️ trash icon → `DELETE` + local clear.
- Minimal change; baaki UI same.

### 1.4 Effort / Risk
Low-Med · Risk LOW (naya table + additive endpoints; auto-save guarded).

---

# FEATURE 2 — Settings / Custom Instructions (three-dot) ⭐

**Goal:** user three-dot → **Settings** me apni instruction/preference de; AI usko yaad rakhe
(prompt me inject). = ChatGPT "custom instructions". (Sir ki "AI ko train karo" wali baat ka
REAL + practical version — model retrain NAHI, context inject. Effect same.)

### 2.1 Table — `ai_user_settings` (ek row per user)
```sql
-- migrations/0007_ai_user_settings.sql
CREATE TABLE IF NOT EXISTS ai_user_settings (
  user_id             INTEGER PRIMARY KEY,   -- users.id
  custom_instructions TEXT,                  -- free text (cap ~500 char)
  reply_language      TEXT,                  -- 'auto' | 'en' | 'hi' (optional)
  default_project     TEXT,                  -- optional (phase 2)
  updated_at          TEXT DEFAULT (datetime('now'))
);
```

### 2.2 Backend
- **Routes:**
  - `GET /api/timesheet/ai/settings` → current user ke settings (na ho to defaults).
  - `PUT /api/timesheet/ai/settings` → upsert (`INSERT ... ON CONFLICT(user_id) DO UPDATE`).
- **Injection (asli jaadu):** controller settings load kare (1 DB read) → `ctx.userSettings` →
  `aiChat`/`brainRouter`/`askCloudflareAI` ko de → **system prompt ke aage** prepend:
  `"User preferences: <custom_instructions>"`.
  - Sirf **brain + fast model** calls pe asar (chhota token add). **Deterministic 0-token paths
    bilkul same** (unka output fixed template hai).
  - `default_project` (phase 2): add flow me jab koi project selected na ho to ye default use ho.
    (Thoda add-flow touch → alag phase, abhi optional.)

### 2.3 Frontend (`AIChatbot.jsx`)
- Header me **three-dot (⋯)** icon (flag/trash/close ke paas). Click → **Settings panel** (widget
  ke andar overlay).
- Fields: custom-instructions textarea (+ optional language dropdown, default-project dropdown).
- Save → `PUT`. Open pe `GET` se prefill.
- Scope: apni hi settings (user_id token se).

### 2.4 Effort / Risk
Med · Risk LOW (additive table + endpoints + UI; prompt-injection optional/guarded).

> Note: system abhi "always English reply" pe set hai (deterministic replies English). Agar
> `reply_language=hi` chuna jaaye to wo **brain/fast** replies ko Hindi karega; fixed deterministic
> templates English hi rahenge jab tak unhe localize na karein (phase 2).

---

# FEATURE 3 (baad me) — Memory from chats 🧠
Feature-1 ke saved chats se chhota **summary/preference** nikaal ke context me daalna
("ye user aksar X project pe kaam karta hai"). Training NAHI — smart context. Feature-1 ke upar banega.

# FEATURE 4 — Profile caching ⚡ (low priority)
Profile already 0-token fast DB read. Caching se sirf ~ms bachega. Iske bajaye profile (naam/role)
ko **prompt me daalna** personalization ke liye zyada useful. Abhi skip.

---

## 🚦 Suggested order
1. **Feature 1 (chat-save DB)** — neev.
2. **Feature 2 (Settings/custom-instructions)** — sabse bada "smart/personal" showpiece.
3. Feature 3 (memory) → Feature 4 (cache) baad me.

## ✅ No-regression guarantees
- Sirf naye `ai_*` tables + naye endpoints + widget me additive UI.
- Auto-save + injection sab `try/catch` — fail ho to chat normal chale.
- Deterministic 0-token routing untouched → speed/accuracy waisी hi.

## ❓ Banane se pehle confirm
1. Tables **Option A** (shared DB) ya **B** (alag AI DB)?
2. Pehle **Feature 1** se shuru (recommended) ya seedha **Feature 2**?
