// FILE: backend/src/index.js
// KAAM: Root bootloader configuration with active CORS policy guards

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRouter from './routers/auth.routes.js';
import timesheetRouter from './routers/timesheet.routes.js';
import publicRouter from './routers/public.routes.js';

const app = new Hono();

// =========================================================================
// 🔓 INTERNAL API CORS — restricts to localhost + known production origins
// =========================================================================
app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return 'http://localhost:8080';
    const allowed = [
      'http://localhost:',
      'http://127.0.0.1:',
      'https://status-ai.pages.dev',   // CF Pages production URL
      'https://keyss.io',               // future custom domain
    ];
    if (allowed.some(prefix => origin.startsWith(prefix))) return origin;
    return 'http://localhost:8080';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposeHeaders: ['Content-Length', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 600,
  credentials: true,
}));

// =========================================================================
// 🌐 PUBLIC API — /v1/* — wildcard CORS (any company website can call this)
// Auth: X-API-Key header (handled inside publicRouter)
// =========================================================================
// Note: publicRouter handles its own CORS middleware internally (cors: '*')

// ── Route Registry ────────────────────────────────────────────────────────
app.route('/api/auth', authRouter);
app.route('/api/timesheet', timesheetRouter);
app.route('/v1', publicRouter);         // 🆕 Public API for external companies

app.get('/', (c) => c.text('KEYSS AI Engine — Status: Live | Docs: /v1/status'));

export default app;