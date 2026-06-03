// FILE: backend/src/index.js
// KAAM: Root bootloader configuration with active CORS policy guards

import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Inbuilt CORS package import kiya
import authRouter from './routers/auth.routes.js';
import timesheetRouter from './routers/timesheet.routes.js';


const app = new Hono();






// =========================================================================
// 🔓 GLOBAL CORS MIDDLEWARE LAYER — env-driven (NOT hardcoded)
// =========================================================================
// Production origins come from the ALLOWED_ORIGINS env var (comma-separated),
// set in wrangler.toml [vars] or as a secret — e.g.
//   ALLOWED_ORIGINS = "https://app.yourcompany.com,https://www.yourcompany.com"
// Any localhost / 127.0.0.1 port is ALWAYS allowed so local dev needs no setup.
// An origin that is neither localhost nor whitelisted gets NO CORS header → the
// browser blocks it. This is what lets the AI work on your real deployed site.
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use('/api/*', cors({
  origin: (origin, c) => {
    if (!origin) return undefined;                 // non-browser / same-origin call
    if (LOCALHOST_RE.test(origin)) return origin;  // local dev — any port
    const allowed = (c.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return allowed.includes(origin) ? origin : undefined; // reflect only if whitelisted
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true, // Cookies transfer karne ke liye ye true hona zaroori hai
}));

// Explicit Application Context Route Endpoints Hydration
app.route('/api/auth', authRouter);
app.route('/api/timesheet', timesheetRouter);



app.get('/', (c) => c.text('KEYSS Timesheet Engine - Serverless Core Live'));

export default app;