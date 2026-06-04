// FILE: backend/src/index.js
// KAAM: Root bootloader configuration with active CORS policy guards

import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Inbuilt CORS package import kiya
import { logger } from 'hono/logger'; // har request terminal pe dikhane ke liye
import authRouter from './routers/auth.routes.js';
import timesheetRouter from './routers/timesheet.routes.js';


const app = new Hono();

// ── REQUEST LOGGER ───────────────────────────────────────────────────────────
// Har incoming request terminal pe dikhata hai:
//   <-- POST /api/auth/login          (request aayi)
//   --> POST /api/auth/login 200 12ms (response gaya, status + time)
// Isse turant pata chalta hai konsi request hit hui aur kya status mila.
app.use('*', logger());






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

// ── GLOBAL ERROR + 404 LOGGING ───────────────────────────────────────────────
// Koi bhi unhandled error → terminal pe method/path + poora message + stack.
app.onError((err, c) => {
  console.error(`❌ [ERROR] ${c.req.method} ${c.req.path} →`, err?.message || err);
  if (err?.stack) console.error(err.stack);
  return c.json({ success: false, message: 'Internal Server Error' }, 500);
});

// Jo route match na ho (jaise galat URL) → terminal pe saaf dikhe.
app.notFound((c) => {
  console.warn(`⚠️  [404] ${c.req.method} ${c.req.path} — koi route match nahi hua`);
  return c.json({ success: false, message: 'Not found' }, 404);
});

export default app;