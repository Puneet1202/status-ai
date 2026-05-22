// FILE: backend/src/index.js
// KAAM: Root bootloader configuration with active CORS policy guards

import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Inbuilt CORS package import kiya
import authRouter from './routers/auth.routes.js';
import timesheetRouter from './routers/timesheet.routes.js';

const app = new Hono();

// =========================================================================
// 🔓 GLOBAL CORS MIDDLEWARE LAYER (Handshake Multi-Port Enabler)
// =========================================================================
app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return 'http://localhost:8080';
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    return 'http://localhost:8080';
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