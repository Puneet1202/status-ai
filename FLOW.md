# KEYSS AI — Flow, System Design & Website Integration (simple)

> Ek hi jagah: tumhara code kaise kaam karta hai, kaunsa file kya karta hai, aur
> ise office ki **Next.js** website me kaise jodna hai. Hinglish, seedhi baat.

---

## 1. Bird's-eye view — 2 alag cheezein, 1 hi database

```
   ┌─────────────────────┐         ┌──────────────────────────┐
   │  SIR ka frontend     │         │  TUMHARI AI service       │
   │  (Next.js website)   │         │  (ye repo — Backend/)     │
   │                      │         │                          │
   │  + AIChatbot widget ─┼──HTTP──▶│  /ai/chat  endpoint       │
   └──────────┬───────────┘         └────────────┬─────────────┘
              │                                   │
              └───────────────┬───────────────────┘
                              ▼
                    ┌───────────────────┐
                    │  SAME Database     │   ← schema 100% same
                    │ (daily_status_...) │
                    └───────────────────┘
```

- Tumhari AI **alag service** hai — sir ke backend me ghusani nahi.
- Dono **same DB** padhte/likhte hain. Isliye data automatically sahi.
- Website me sirf **ek chat widget** add hota hai. Bas.

---

## 2. Ek message ka pura safar (request flow)

User chat me likhta hai → ye hota hai:

```
User message
   │
   ▼
[1] Greeting/“thanks”?  ── haan──▶ canned reply (FREE, no AI)
   │ nahi
   ▼
[2] "mera naam?"  ──haan──▶ profile from login token (FREE)
   │ nahi
   ▼
[3] 🧠 BRAIN (Claude) — message padho, sahi TOOL chuno + args nikaalo
   │     (add / get / query / analyze / update / delete)
   │   • Naya log? → time deterministic parser se nikaalo (tested)
   │   • Edit/Delete? → wahi tool, confirm ke saath
   │  (key na ho / error → niche deterministic engine fallback)
   ▼
[4] TOOL HANDLER — validate (2hr cap, overlap, employee scope) + SQL
   ▼
[5] Reply user ko
```

Yaad rakho: **Brain decide karta hai KYA karna hai; tested code KARTA hai (safe).**

---

## 3. File map — kaunsa file kya karta hai

```
Backend/
├─ src/
│  ├─ index.js ............... app start (routes jodta hai)
│  ├─ server.node.js ......... Node pe chalata hai + .env padhta hai
│  ├─ ai/
│  │  ├─ chat.js ............. 🧠 DIMAAG: message → kaunsa tool (brain + fallback)
│  │  ├─ claudeRouter.js ..... Claude ko bulata hai (intent + args)
│  │  ├─ ai-config.js ........ settings: model, brain on/off, limits
│  │  ├─ timeParser.js ....... "9-11" → 09:00-11:00 (deterministic, tested)
│  │  ├─ blockExtractor.js ... ek message se kaam ke time-blocks nikaalta hai
│  │  ├─ providers/
│  │  │  ├─ anthropic.js ..... Claude API call (SDK + caching)
│  │  │  └─ cloudflare*.js ... purana llama provider (fallback)
│  │  └─ tools/ ............. har KAAM ka alag file (yahan asli SQL hota hai)
│  │     ├─ addTimesheet.tool.js ...... entry add
│  │     ├─ getTimesheet.tool.js ...... entries dikhao
│  │     ├─ queryTimesheet.tool.js .... filter (keyword/time/duration)
│  │     ├─ analyzeTimesheet.tool.js .. totals/breakdown
│  │     ├─ updateTimesheet.tool.js ... entry badlo
│  │     ├─ deleteTimesheet.tool.js ... entry hatao (confirm)
│  │     └─ index.js .................. saare tools ka registry
│  ├─ controllers/ .......... request handle (auth, rate-limit, dispatch)
│  ├─ middlewares/auth ...... JWT login verify
│  └─ db/sqliteAdapter.js ... ek SQLite file ko DB ki tarah kholta hai
├─ tests/ .................. automatic tests (npm test → 66 pass)
├─ scripts/ ................ test-brain / verify / check-questions
└─ docs/ .................. guides

Frontend/src/components/AIChatbot.jsx ... ⭐ chat widget (website me yahi jodna hai)
```

> Naya kaam (tool) add karna ho? Bas `tools/` me ek file banao + `tools/index.js`
> me jodo. `chat.js` ya controller chhune ki zaroorat nahi.

---

## 4. Office Next.js website me kaise add karu (step-by-step)

**Sir ki website Next.js me hai — toh ye karo:**

1. **AI backend chalao** (alag server pe, same DB pe point karke).
   Dev me: `cd Backend && npm run dev:node` → `http://localhost:8787`.

2. **Widget file copy karo** → `Frontend/src/components/AIChatbot.jsx` ko sir ke
   Next.js project me `components/AIChatbot.jsx` me daal do.

3. **Install:** `npm install lucide-react` (icons). Tailwind CSS hona chahiye.

4. **Render karo** (layout ya kisi page me, ek line):
   ```jsx
   'use client';
   import AIChatbot from '@/components/AIChatbot';

   export default function Page() {
     return <AIChatbot apiBaseUrl="https://tumhari-ai-url.com" />;
   }
   ```
   *(Next.js App Router me file ke top pe `'use client';` zaroori hai — widget browser APIs use karta hai.)*

5. **Auth:** widget login token bhejega. Sabse easy — sir ke login JWT secret
   ko AI ke `.env` me `ACCESS_TOKEN_SECRET` me daal do → AI sir ke token ko hi
   verify kar lega. (Token me `employee_id` hona chahiye.)

### ⭐ "apiBaseUrl" kya hai? (tumhara sawaal)
**apiBaseUrl = tumhari AI backend ka address (URL).** Widget ko pata hona chahiye
ki message KAHAN bheje. Bas itna:
- Dev me: `apiBaseUrl="http://localhost:8787"`
- Production me: `apiBaseUrl="https://your-deployed-ai.com"` (jahan AI deploy hui)

Yeh ek **prop** hai — widget ke andar kuch nahi badalna. Sirf ye URL daalna hai.

---

## 5. Model best kaunsa? — ye 6 cheezein dekho

Jab bhi koi AI model choose karo, **inko compare karo:**

| # | Cheez | Kyun zaroori | Humara Haiku |
|---|-------|--------------|--------------|
| 1 | **Tool-calling quality** | Sahi tool + args chune (humara core kaam) | ⭐ Best |
| 2 | **Cost** ($/million tokens) | Kitna mehnga per message | Sasta (~$0.003/msg) |
| 3 | **Speed** (latency) | Kitni jaldi jawab (~1s achha) | ~1s |
| 4 | **Language** | Hindi/Hinglish samjhe | ⭐ Achha |
| 5 | **Reliability** | Same input → same output | ⭐ Achha |
| 6 | **Rate limits** | Plan pe kitne req/min allowed | Theek |

**Tumhare app ke liye #1 (tool-calling) sabse important hai** — kyunki AI ka kaam
hi sahi tool chunna hai. Iske baad cost dekho.

### Options (sir ko dikhane ke liye)
| Model | Per message | Tool-calling | Note |
|-------|-------------|--------------|------|
| Claude Haiku 4.5 (abhi) | ~$0.003 | ⭐ Best | Reliable |
| GPT-4o-mini | ~$0.0004 | Achha | ~7x sasta |
| Gemini Flash | ~$0.0003 | Achha | ~10x sasta (key slot already hai) |
| Cloudflare llama | ~free | Kamzor | Purana problem |

> Provider/model badalna = sirf `.env` (CODE nahi): `AI_PROVIDER=anthropic|openai|gemini`
> + us provider ki key. Anthropic, OpenAI, Gemini — teeno ready. Detail `SETUP-OFFICE.md` STEP 5.

---

## 6. Token bachane ke knobs (already lage hain)
- Greeting/profile → FREE (brain nahi).
- Rate limit per user → `.env` me `AI_RATE_PER_MIN` (default 20/min).
- Brain band karna → `.env` me `AI_BRAIN=off` (ya key hata do) → purana free system.
