# KEYSS AI Chatbot — Integration Guide

How to drop the AI timesheet chatbot into another website (e.g. the company site
whose frontend is being built separately).

> TL;DR — the chatbot is **one self-contained React component**. Copy it, install
> `lucide-react`, make sure Tailwind CSS is present, and render it with **one line**:
> `<AIChatbot apiBaseUrl="http://localhost:8787" />`. Only the API URL and the
> login token change between projects — both are **props**, so you never edit the
> component's insides.

---

## 1. The two parts

| Part | What it is | Where |
|------|------------|-------|
| **Backend** | The "engine" — Cloudflare Worker + D1 database + Workers AI. Exposes the API. | `backend/` |
| **Chatbot UI** | A single React component (React + lucide-react + Tailwind). | `Frontend/src/components/AIChatbot.jsx` |

The other website only needs to **(a)** talk to the running backend and **(b)** drop in the component.

---

## 2. Run / reach the backend

**Local (development):**
```bash
cd backend
npm install
npm run dev          # → http://localhost:8787
```
Test it: open `http://localhost:8787/` → you should see
`KEYSS Timesheet Engine - Serverless Core Live`.

---

## 3. Add the component to the other frontend (React / Next.js)

1. **Copy** `Frontend/src/components/AIChatbot.jsx` into the other project (e.g. `components/AIChatbot.jsx`).
2. **Install icons:** `npm install lucide-react`
3. **Tailwind CSS must be set up** in that project — the component is styled entirely with Tailwind classes. (Check for a `tailwind.config.js`.) Without Tailwind the chatbot works but looks unstyled.
4. **Render it** anywhere (it's a floating button, so a layout/root is ideal):
   ```jsx
   import AIChatbot from './components/AIChatbot';

   <AIChatbot apiBaseUrl="http://localhost:8787" />
   ```
5. **Next.js (App Router):** the file already starts with `'use client';` — keep it (the chatbot uses `localStorage`/browser APIs).

---

## 4. Auth / login token (important)

The chatbot calls the backend with `Authorization: Bearer <token>`. It needs a token:

- **Default:** it reads `localStorage['keyss_token']`. If the site stores the login token under that key, nothing else to do.
- **Or pass it directly:** `<AIChatbot apiBaseUrl="..." token={yourToken} />`
- **Get a token:** `POST {apiBaseUrl}/api/auth/login` with body `{ "email": "...", "password": "..." }` → returns the token.

> The token must come from **THIS** backend's `/api/auth/login` (it only accepts tokens it issued). The company site's own login is separate — wiring the two auth systems together is a later task; for testing, just use a KEYSS login token.

---

## 5. Props — the only things that change between environments

| Prop | Purpose | Default |
|------|---------|---------|
| `apiBaseUrl` | Base URL of the backend | `http://localhost:8787` |
| `token` | Login JWT (optional — overrides localStorage) | `null` |
| `tokenKey` | localStorage key that holds the token | `'keyss_token'` |

You do **not** need to edit anything inside `AIChatbot.jsx`. Everything environment-specific is a prop.

---

## 6. "What do I change, and where?" — checklist

- [ ] Backend running and reachable (`apiBaseUrl` points to it)
- [ ] `npm install lucide-react`
- [ ] Tailwind CSS present in the project
- [ ] A valid login token available (in `localStorage['keyss_token']`, or passed via the `token` prop)
- [ ] `<AIChatbot apiBaseUrl=... />` rendered once (floating widget)
- [ ] (Next.js only) `'use client';` kept at the top of the file

---

## 7. API endpoints the chatbot uses

All require the header `Authorization: Bearer <token>`.

| Method & path | Purpose |
|---------------|---------|
| `GET  /api/timesheet/projects` | Project list (dropdown) |
| `GET  /api/timesheet/projects/:id/tasks` | Tasks of a project |
| `POST /api/timesheet/ai/chat` | The AI chat (log / show / etc.) |
| `POST /api/timesheet/ai/report` | "Report a wrong reply" snapshot |

`POST /api/timesheet/ai/chat` body:
```json
{
  "message": "9 se 11 fixed the login bug",
  "history": [{ "role": "user", "content": "..." }],
  "selectedProject": "AI Project",
  "selectedTasks": ["Bug Fixing"],
  "timezone": "Asia/Kolkata",
  "pendingAction": null
}
```

---

## 8. CORS

- **Local:** any `localhost` / `127.0.0.1` port is allowed automatically — no setup needed.
- **Production:** add the website's real domain to `ALLOWED_ORIGINS` in `backend/wrangler.toml` (comma-separated), then redeploy. Otherwise the browser **blocks** every API call.

---

## 9. Going to production

1. **Deploy the backend:** `cd backend && npx wrangler deploy` → you get a public URL.
2. **CORS:** add the site domain to `ALLOWED_ORIGINS` (wrangler.toml) and redeploy.
3. **Point the frontend at it:** `<AIChatbot apiBaseUrl="https://your-backend-url" />`
4. **Apply DB migrations to the remote D1** (if not already):
   ```bash
   npx wrangler d1 execute keyss-timesheet-db --remote --file=migrations/0003_add_feedback_transcript.sql
   ```

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Chatbot shows but looks unstyled / broken | Tailwind CSS not set up in the project |
| Projects don't load / 401 errors | Token missing or invalid — check `localStorage['keyss_token']` |
| Console shows CORS errors | (prod) add domain to `ALLOWED_ORIGINS`; (local) make sure the backend is running |
| `lucide-react` import error | `npm install lucide-react` |
| Next.js: "localStorage is not defined" | Keep `'use client';` at the top of `AIChatbot.jsx` |
