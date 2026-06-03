# Session Notes — 2026-06-03

Working notes so this work can be continued on another machine (e.g. office).
Branch: `project-task-add-in-scehma`.

## What was done this session (all committed)

1. **Timezone fix** — `today`/`kal`/`yesterday` now resolve in the user's IANA
   timezone (sent from the frontend as `timezone`), not UTC. Fixes night-shift
   users logging the wrong date. Files: `Backend/src/ai/tools/_helpers.js`
   (`todayISO(tz, now)`), `chat.js`, `tools.js`, `timesheet.controller.js`,
   `Frontend/src/components/AIChatbot.jsx`.
2. **CORS → env-driven** — `Backend/src/index.js` now allows origins from the
   `ALLOWED_ORIGINS` env var (comma-separated) + any localhost. Previously it
   was hardcoded to localhost only, which would block a real deployed website.
   Set the value in `Backend/wrangler.toml` [vars].
3. **pendingAction persist** — chatbot saves the pending confirm action to
   localStorage so a page refresh mid delete/update doesn't break the flow.
4. **Rate limit** — per-user throttle on the AI endpoint
   (`aiRateLimitOk` in `timesheet.controller.js`). Uses Cloudflare's native
   rate-limit binding; it's a no-op until you UNCOMMENT the `[[unsafe.bindings]]`
   block in `wrangler.toml` and deploy.
5. **Conversation quality** — widened `UPDATE_INTENT` in `chat.js` (catches
   "sahi kar do", "change that to", "badal do", "that was wrong") and added
   agile ceremonies (standup/sprint/demo/retro) to the MODULE rules in
   `timeParser.js`.
6. **Report / feedback feature** — new `ai_feedback` table
   (`migrations/0002_add_ai_feedback.sql`), `POST /ai/report` endpoint
   (`submitAiFeedback`), and a 🚩 Report button in the chatbot that snapshots the
   last 10 messages. This is the "AI learning" loop: review reports → turn real
   mistakes into test cases / prompt examples (NOT model retraining).

## Tests
- Offline (no server): `cd Backend && npm test` → 49 passing. Includes
  `tests/timezone.test.mjs` and `tests/scenarios.test.mjs` (short/long/night-shift/
  Hinglish/arrows/modules).
- Live AI+DB stress: `cd Backend && npm run test:stress` (needs `wrangler dev`
  running + `.dev.vars`). Messy real-world cases added in `test/cases.mjs`.

## To run LOCALLY on a fresh machine (office)
`.dev.vars` is git-ignored (secrets never go to GitHub), so create it here:
```
# Backend/.dev.vars
ACCESS_TOKEN_SECRET=<any-long-random-string>
REFRESH_TOKEN_SECRET=<any-other-long-random-string>
```
Then: `cd Backend && npx wrangler dev`.

## Remaining deploy steps (to production / real website)
1. `cd Backend`
2. Apply the new table to remote D1 (DONE on 2026-06-03 if already run):
   `npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0002_add_ai_feedback.sql`
3. Set your real frontend domain in `wrangler.toml`:
   `ALLOWED_ORIGINS = "https://your-frontend-domain.com"`
4. `npx wrangler deploy`   ← pushes the new code (Report endpoint, CORS, timezone) live
5. Deploy the frontend with `VITE_API_URL` pointing at the worker URL.
- ⚠️ NEVER run `Backend/schema.sql` on remote — it has DROP TABLE and wipes data.

## Notes / deferred
- Refresh-token revocation is NOT implemented (security hardening for later;
  needs a `token_version` column + auto-refresh flow). Not a crash.
- Auth code (auth.controller / auth.middleware / auth.routes) was NOT modified
  this session — any login issue is unrelated to these changes (likely an
  expired browser session: clear localStorage + cookies and re-login).
