// FILE: backend/src/controllers/auth.controller.js
// OTP-BASED AUTH — aligned to the production schema (keyss-status.prod.db).
//
// Why OTP (no passwords): in prod.db a login identity is SPLIT across three tables
// and there is NO password column anywhere — but there IS an `otps` table:
//   users     → id, email, role_id, employee_id, client_id, is_active   (the login)
//   employee  → name, designation, …                                    (the person)
//   roles     → name ('admin' | 'hr' | 'employee' | 'client' | …)       (the role)
// So we authenticate by EMAIL → emailed one-time code → JWT. The token carries the
// resolved identity (id, email, role, name) AND employee_id, because timesheet rows
// key off employee.id (NOT users.id — the two are different ids).
//
// Flow:
//   POST /auth/request-otp  { email }        → emails a 6-digit code (rows in `otps`)
//   POST /auth/verify-otp   { email, otp }    → verifies, issues access+refresh JWTs
//   GET  /auth/me                              → current identity (from the token + DB)
//   POST /auth/refresh                         → rotates tokens
//   GET  /auth/users                           → admin-only user list (names via JOIN)

import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie } from 'hono/cookie';
import { sendOtpEmail, OTP_TTL_MINUTES } from '../services/mailer.js';

// ─── TOKEN LIFETIMES (single source of truth) ─────────────────────────────────
// Used by BOTH verify-otp and refresh so the two can never drift apart. SECONDS.
// Access stays long-lived on purpose: the frontend has no silent auto-refresh yet,
// so a short access token would log users out with no recovery.
const ACCESS_TOKEN_TTL = 7 * 24 * 60 * 60;   // 7 days
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days

// Resend throttle: refuse a new OTP if one was issued < this many seconds ago.
const OTP_RESEND_COOLDOWN_SEC = 30;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getCookieConfig(c, maxAgeSeconds) {
    const url = c.req.url;
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    return {
        httpOnly: true,
        secure: isLocal ? false : true,
        sameSite: isLocal ? 'Lax' : 'None',
        maxAge: maxAgeSeconds,
        path: '/',
    };
}

const normalizeEmail = (e) => String(e || '').toLowerCase().trim();
const sqlNow = () => new Date().toISOString().replace('T', ' ').slice(0, 19); // 'YYYY-MM-DD HH:MM:SS' (matches datetime('now'))

// Resolve a full login identity by a unique column. Joins the person (name) and
// role so callers never have to know the 3-table split.
async function resolveIdentityByEmail(db, email) {
    return db
        .prepare(
            `SELECT u.id, u.email, u.employee_id, u.client_id, u.is_active,
                    r.name AS role, COALESCE(e.name, '') AS name
               FROM users u
               JOIN roles r    ON r.id = u.role_id
               LEFT JOIN employee e ON e.id = u.employee_id
              WHERE LOWER(u.email) = ?`
        )
        .bind(email)
        .first();
}

async function resolveIdentityById(db, id) {
    return db
        .prepare(
            `SELECT u.id, u.email, u.employee_id, u.client_id, u.is_active,
                    r.name AS role, COALESCE(e.name, '') AS name
               FROM users u
               JOIN roles r    ON r.id = u.role_id
               LEFT JOIN employee e ON e.id = u.employee_id
              WHERE u.id = ?`
        )
        .bind(id)
        .first();
}

// Mint access+refresh tokens and set them as cookies. Returns the token strings.
async function issueSession(c, identity) {
    if (!c.env.ACCESS_TOKEN_SECRET || !c.env.REFRESH_TOKEN_SECRET) {
        throw new Error('JWT secrets missing (ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET)');
    }
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await sign(
        {
            id: identity.id,
            email: identity.email,
            role: identity.role,
            name: identity.name,
            employee_id: identity.employee_id, // ← timesheet rows key off this
            exp: now + ACCESS_TOKEN_TTL,
        },
        c.env.ACCESS_TOKEN_SECRET
    );

    const refreshToken = await sign(
        { id: identity.id, exp: now + REFRESH_TOKEN_TTL },
        c.env.REFRESH_TOKEN_SECRET
    );

    setCookie(c, 'access_token', accessToken, getCookieConfig(c, ACCESS_TOKEN_TTL));
    setCookie(c, 'refresh_token', refreshToken, getCookieConfig(c, REFRESH_TOKEN_TTL));

    return { accessToken, refreshToken };
}

const publicUser = (i) => ({
    id: i.id,
    email: i.email,
    name: i.name,
    role: i.role,
    employee_id: i.employee_id,
});

// ─── REQUEST OTP ──────────────────────────────────────────────────────────────
export const requestOtpController = async (c) => {
    try {
        const { email } = await c.req.json();
        const identifier = normalizeEmail(email);
        if (!identifier) {
            return c.json({ message: 'Email is required', success: false }, 400);
        }

        const db = c.env.DB;
        const identity = await resolveIdentityByEmail(db, identifier);

        // Unknown / disabled account → generic response (no user enumeration).
        if (!identity || identity.is_active === 0) {
            return c.json(
                { message: 'If an account exists for this email, a login code has been sent.', success: true },
                200
            );
        }

        // If a code was sent very recently and is still unused, DON'T spam a new
        // one — the existing code is still valid. Reuse it and let the user move
        // on to enter it (success, not a scary error).
        const recent = await db
            .prepare(
                `SELECT otp_code, created_at FROM otps
                  WHERE user_id = ? AND is_used = 0
                  ORDER BY id DESC LIMIT 1`
            )
            .bind(identity.id)
            .first();
        if (recent?.created_at) {
            const ageSec = (Date.now() - new Date(recent.created_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
            if (ageSec >= 0 && ageSec < OTP_RESEND_COOLDOWN_SEC) {
                // Dev: re-print the still-valid code so it's easy to find in the terminal.
                if (!c.env.SENDGRID_API_KEY) {
                    console.log(
                        `\n\n` +
                        `============================================\n` +
                        `   🔑  LOGIN OTP (dev — still valid)\n` +
                        `   ${identity.email}\n` +
                        `   CODE  →   ${recent.otp_code}\n` +
                        `============================================\n\n`
                    );
                }
                return c.json(
                    { message: 'A code was already sent to your email — please enter it (valid for 10 minutes).', success: true },
                    200
                );
            }
        }

        // 6-digit code + expiry. Invalidate this user's previous unused codes so
        // only the latest one is ever valid.
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
            .toISOString().replace('T', ' ').slice(0, 19);

        await db.prepare(`UPDATE otps SET is_used = 1 WHERE user_id = ? AND is_used = 0`).bind(identity.id).run();
        await db
            .prepare(
                `INSERT INTO otps (user_id, identifier, otp_code, expires_at, is_used, created_at)
                 VALUES (?, ?, ?, ?, 0, ?)`
            )
            .bind(identity.id, identifier, otp, expiresAt, sqlNow())
            .run();

        // Email it (or log it in dev). A delivery failure must surface as an error.
        await sendOtpEmail(c.env, identity.email, otp);

        return c.json(
            { message: 'A login code has been sent to your email.', success: true },
            200
        );
    } catch (error) {
        console.error('[Request OTP Error]:', error);
        return c.json({ message: error.message || 'Could not send login code', success: false }, 500);
    }
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
export const verifyOtpController = async (c) => {
    try {
        const { email, otp } = await c.req.json();
        const identifier = normalizeEmail(email);
        const code = String(otp || '').trim();

        if (!identifier || !code) {
            return c.json({ message: 'Email and code are required', success: false }, 400);
        }

        const db = c.env.DB;
        const identity = await resolveIdentityByEmail(db, identifier);
        if (!identity || identity.is_active === 0) {
            return c.json({ message: 'Invalid code. Please try again.', success: false }, 401);
        }

        // Latest unused, unexpired code for this user that matches.
        const row = await db
            .prepare(
                `SELECT id, expires_at FROM otps
                  WHERE user_id = ? AND otp_code = ? AND is_used = 0
                  ORDER BY id DESC LIMIT 1`
            )
            .bind(identity.id, code)
            .first();

        if (!row) {
            return c.json({ message: 'Invalid code. Please try again.', success: false }, 401);
        }

        const expired = new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now();
        // Burn the code regardless (single use), then reject if it was expired.
        await db.prepare(`UPDATE otps SET is_used = 1 WHERE id = ?`).bind(row.id).run();
        if (expired) {
            return c.json({ message: 'That code has expired. Please request a new one.', success: false }, 401);
        }

        const { accessToken, refreshToken } = await issueSession(c, identity);

        return c.json(
            {
                message: 'Login successful',
                user: publicUser(identity),
                token: accessToken,
                refresh_token: refreshToken,
                success: true,
            },
            200
        );
    } catch (error) {
        console.error('[Verify OTP Error]:', error);
        return c.json({ message: 'Internal Server Error', success: false }, 500);
    }
};

// ─── GET PROFILE (/me) ────────────────────────────────────────────────────────
export const getProfileHandler = async (c) => {
    try {
        const currentUser = c.get('user');
        const db = c.env.DB;
        const identity = await resolveIdentityById(db, currentUser.id);

        if (!identity) {
            return c.json({ message: 'User not found', success: false }, 404);
        }
        return c.json({ success: true, user: publicUser(identity) }, 200);
    } catch (error) {
        console.error('[Profile Error]:', error);
        return c.json({ message: 'Failed to retrieve profile', success: false }, 500);
    }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export const refreshTokenController = async (c) => {
    try {
        let refreshToken = getCookie(c, 'refresh_token');
        if (!refreshToken) {
            try {
                const body = await c.req.json();
                if (body?.refresh_token) refreshToken = body.refresh_token;
            } catch (e) { /* no body */ }
        }
        if (!refreshToken) {
            return c.json({ message: 'Refresh token missing. Please login again.', success: false }, 401);
        }

        const decoded = await verify(refreshToken, c.env.REFRESH_TOKEN_SECRET);
        const db = c.env.DB;
        const identity = await resolveIdentityById(db, decoded.id);
        if (!identity || identity.is_active === 0) {
            return c.json({ message: 'User not found.', success: false }, 401);
        }

        const { accessToken, refreshToken: newRefresh } = await issueSession(c, identity);

        return c.json(
            {
                message: 'Token refreshed',
                token: accessToken,
                refresh_token: newRefresh,
                user: publicUser(identity),
                success: true,
            },
            200
        );
    } catch (error) {
        console.error('[Refresh Token Error]:', error);
        return c.json({ message: 'Invalid refresh token. Please login again.', success: false }, 401);
    }
};

// ─── GET ALL USERS (Admin only) ───────────────────────────────────────────────
export const getAllUsers = async (c) => {
    try {
        const currentUser = c.get('user');
        if (currentUser.role !== 'admin' && currentUser.role !== 'supreradmin') {
            return c.json({ message: 'Access denied: Admin only', success: false }, 403);
        }

        const db = c.env.DB;
        const { results } = await db
            .prepare(
                `SELECT u.id, u.email, COALESCE(e.name, '') AS name, r.name AS role, u.created_at
                   FROM users u
                   JOIN roles r    ON r.id = u.role_id
                   LEFT JOIN employee e ON e.id = u.employee_id
                  ORDER BY u.id ASC`
            )
            .all();

        return c.json({ total_users: results.length, users: results, success: true }, 200);
    } catch (error) {
        console.error('[GetAllUsers Error]:', error);
        return c.json({ message: 'Internal Server Error', success: false }, 500);
    }
};
