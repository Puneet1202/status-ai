# KEYSS AI — Office Setup & Connect Checklist

> Office jaake ye steps follow karo. Har step tick karte jao. (Detail samajhna ho
> to `FLOW.md` padho — ye sirf "kya karna hai" hai.)

---

## ✅ STEP 1 — AI backend chalao
```powershell
cd Backend
npm install
npm run dev:node
```
Chalega → `http://localhost:8787`. Browser me kholo → "KEYSS ... Live" dikhe = OK.

---

## ✅ STEP 2 — `.env` me keys daalo (`Backend/.env`)
| Key | Kya | Zaroori? |
|-----|-----|----------|
| `ANTHROPIC_API_KEY` | Claude brain ON. `sk-ant-...` (console.anthropic.com) | Smart AI ke liye haan |
| `AI_MODEL` | Model — default `claude-haiku-4-5` | Optional |
| `AI_RATE_PER_MIN` | Per-user msg/min limit (default 20) | Optional |
| `REPORT_WEBHOOK_URL` | Slack/Discord webhook → report alerts | Optional |
| `ACCESS_TOKEN_SECRET` | **Sir ke login ka JWT secret** (auth ke liye) | Integration me haan |
| `ALLOWED_ORIGINS` | Website ka domain (CORS), comma-separated | Production me haan |

> Key na ho → app phir bhi chalta hai (purana deterministic mode). Kuch tootega nahi.

---

## ✅ STEP 3 — Next.js website me widget jodo
Sir ki website **Next.js** me hai. 3 cheez:

1. **Copy:** `Frontend/src/components/AIChatbot.jsx` → unke project me `components/AIChatbot.jsx`.
2. **Install:** `npm install lucide-react` (Tailwind CSS hona chahiye).
3. **Render** (ek line, layout/page me):
   ```jsx
   'use client';
   import AIChatbot from '@/components/AIChatbot';
   export default function Page(){ return <AIChatbot apiBaseUrl="https://tumhari-ai-url" />; }
   ```

**`apiBaseUrl` = tumhari AI backend ka URL** (jahan STEP 1 chal raha). Dev me `http://localhost:8787`.

---

## ✅ STEP 4 — Auth connect (sabse important)
Widget login token bhejega. AI usse verify karega. Sabse easy:
- Sir ke backend ka **JWT secret** → AI ke `.env` me `ACCESS_TOKEN_SECRET` me daal do.
- Sir ke login token me **`employee_id`** hona chahiye.
- → AI sir ke existing login ko hi maan lega. **Alag login nahi.**

**Sir se 3 cheez pooch lena:** (1) JWT use karte ho? (2) token me `employee_id` hai? (3) secret kya hai?

---

## ✅ STEP 5 — Model badalna (jab chahiye)
- **Claude versions** (Haiku ↔ Sonnet ↔ Opus): sirf `.env` me `AI_MODEL=` badlo. **Code nahi.**
- **OpenAI / Gemini pe jaana** ho: sirf key se nahi hoga — ek chhota adapter file chahiye (~30 min). Architecture isolated hai, baaki code same. (Bolo to bana du.)

---

## ✅ STEP 6 — Report alerts (Slack/Discord)
1. Slack: Incoming Webhook banao → URL copy. (Ya Discord: channel → Webhooks → URL.)
2. `.env` me: `REPORT_WEBHOOK_URL=...`
3. Koi user 🚩 Report dabaaye → turant transcript Slack pe.

---

## ✅ STEP 7 — Production deploy (jab ready)
1. AI backend deploy karo (alag server / Cloudflare). Public URL milega.
2. `ALLOWED_ORIGINS` me website ka domain daalo (CORS), warna browser block karega.
3. `<AIChatbot apiBaseUrl="https://deployed-ai-url" />` set karo.
4. AI same production DB pe point kare (schema already same).

---

## 🔍 Test commands
```powershell
npm test                # 66 automatic tests (sab pass hone chahiye)
npm run test:brain      # Claude ko tedhi-medhi lines pe chala ke dekho (key chahiye)
npm run verify          # DB se sach nikaal ke AI ke jawab check kare
```

## 🆘 Common dikkat
| Problem | Fix |
|---------|-----|
| Chatbot dikha par 401 | Token galat — `ACCESS_TOKEN_SECRET` / login token check |
| CORS error | `ALLOWED_ORIGINS` me domain daalo |
| Chatbot unstyled | Tailwind CSS setup nahi |
| "insufficient credit" | Anthropic me $5 daalo |
