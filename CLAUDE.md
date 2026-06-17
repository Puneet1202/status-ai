# status_app — AI backend (project context)

## Stack
- Backend: Hono / Node.js, port **8787** (`npm run dev:node`)
- DB: Cloudflare D1, local base = `./data/keyss-status.prod.db` (D1_LOCAL_PATH) — source of truth, align to its schema.
- Frontend (separate repo): `C:\Users\Puneet Kumar\Desktop\day2\react-keyss-status` (Next.js + Hono + D1).

## Repo boundary (IMPORTANT)
- `react-keyss-status` = **company repo**. UI only is the user's. **Never push, never change its DB.** Read-only (UI-local edits only if asked). AI widget render lives there: `src/components/AIChatbot.jsx` + `src/app/(dashboard)/layout.tsx`.
- All AI work happens here in `status_app`.

## AI structure
- Tools: `Backend/src/ai/tools/` (getTimesheet, queryTimesheet, analyzeTimesheet, getMyLeaves/Projects/Tasks). Registered in `tools/index.js`.
- Router: `Backend/src/ai/brainRouter.js`; chat: `chat.js`; time parse: `timeParser.js`.
- Providers: `Backend/src/ai/providers/` (Cloudflare etc.). Switch model via `.env` only.
- Auth: email-OTP (dev OTP in wrangler console). Widget sends `Authorization: Bearer <token>`.

## Rules
- Reply in **Hinglish**, concise, code over theory. User reports symptoms, not code.
- Analytics = SQL `analyze_timesheet` tool (NOT RAG/vector), scoped to employee_id.
- Select-chips: backend sends DB-built `options`; frontend renders clickable chips (no hallucination). Project = pill context, never injected as message text; don't treat a bare digit as a time.
- localStorage keys are per-user (e.g. `keyss_chat_history_<userId>`).
