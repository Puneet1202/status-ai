// FILE: backend/src/controllers/auth.controller.js
// KAAM: Secure User registration, login, and user fetch
// STACK: Hono + Cloudflare D1 + Native Edge Crypto JWT

import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie } from 'hono/cookie';

// ─── Cookie config helper ───────────────────────────────────────────────────
// BUG FIX: secure:true + sameSite:None = browser BLOCKS cookies on HTTP localhost
// Fix: secure:false for localhost dev so cookies actually get sent & received
function getCookieConfig(isLocal) {
    if (isLocal) {
        return {
            httpOnly: true,
            secure: false,      // HTTP localhost pe secure:false zaroori hai
            sameSite: 'Lax',    // Lax works fine for same-origin dev
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        };
    }
    return {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
    };
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
export const registerController = async (c) => {
    try {
        const { email, name, password } = await c.req.json();
        const db = c.env.DB;

        if (!email || !name || !password) {
            return c.json({ message: "All fields required: email, name, password", status: 400 }, 400);
        }

        const existingUser = await db
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(email.toLowerCase().trim())
            .first();

        if (existingUser) {
            return c.json({ message: "Email already registered", status: 400 }, 400);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Auto-detect admin role: email domain "admin" se start kare toh admin
        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const assignedRole = emailDomain.startsWith('admin') ? 'admin' : 'employee';

        const result = await db
            .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
            .bind(name.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole)
            .run();

        if (!result.success) {
            throw new Error("Database insertion failed");
        }

        return c.json({ message: "User registered successfully", status: 200 }, 200);

    } catch (error) {
        console.error("[Register Error]:", error);
        return c.json({ message: error.message || "Internal Server Error", status: 500 }, 500);
    }
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────
export const loginController = async (c) => {
    try {
        const { email, name, username, password } = await c.req.json();
        const db = c.env.DB;

        const identifier = (email || name || username || '').toLowerCase().trim();

        if (!identifier || !password) {
            return c.json({ message: "Email/username and password required", status: 400 }, 400);
        }

        // Try email first, then name
        let user = await db
            .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
            .bind(identifier)
            .first();

        if (!user) {
            user = await db
                .prepare("SELECT * FROM users WHERE LOWER(name) = ?")
                .bind(identifier)
                .first();
        }

        if (!user) {
            return c.json({ message: "Invalid credentials", status: 401 }, 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return c.json({ message: "Invalid credentials", status: 401 }, 401);
        }

        const now = Math.floor(Date.now() / 1000);
        const accessPayload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            exp: now + (7 * 24 * 60 * 60)  // 7 days
        };

        // BUG FIX: ACCESS_TOKEN_SECRET check — agar undefined hai toh clear error
        if (!c.env.ACCESS_TOKEN_SECRET || !c.env.REFRESH_TOKEN_SECRET) {
            console.error("[CRITICAL] JWT secrets missing from environment!");
            return c.json({ message: "Server configuration error", status: 500 }, 500);
        }

        const accessToken = await sign(accessPayload, c.env.ACCESS_TOKEN_SECRET);
        const refreshToken = await sign({ id: user.id, exp: now + (30 * 24 * 60 * 60) }, c.env.REFRESH_TOKEN_SECRET);

        // Detect local vs production
        const requestUrl = c.req.url;
        const isLocal = requestUrl.includes('localhost') || requestUrl.includes('127.0.0.1');
        const cookieConfig = getCookieConfig(isLocal);

        setCookie(c, 'access_token', accessToken, cookieConfig);
        setCookie(c, 'refresh_token', refreshToken, cookieConfig);

        return c.json({
            message: "Login successful",
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            token: accessToken,
            refresh_token: refreshToken,
            status: 200
        }, 200);

    } catch (error) {
        console.error("[Login Error]:", error);
        return c.json({ message: "Internal Server Error", status: 500 }, 500);
    }
};

// ─── GET ALL USERS (Admin only) ───────────────────────────────────────────────
export const getAllUsers = async (c) => {
    try {
        // BUG FIX: Role check — sirf admin hi all users dekh sakta hai
        const currentUser = c.get('user');
        if (currentUser.role !== 'admin') {
            return c.json({ message: "Access denied: Admin only", status: 403 }, 403);
        }

        const db = c.env.DB;
        const { results } = await db
            .prepare("SELECT id, email, name, role, created_at FROM users")
            .all();

        return c.json({ total_users: results.length, users: results, status: 200 }, 200);

    } catch (error) {
        console.error("[GetAllUsers Error]:", error);
        return c.json({ message: "Internal Server Error", status: 500 }, 500);
    }
};

// ─── GET PROFILE (/me) ────────────────────────────────────────────────────────
export const getProfileHandler = async (c) => {
    try {
        const currentUser = c.get('user');
        const db = c.env.DB;

        const user = await db
            .prepare("SELECT name, email, role FROM users WHERE id = ?")
            .bind(currentUser.id)
            .first();

        if (!user) {
            return c.json({ message: "User not found", status: 404 }, 404);
        }

        return c.json({
            success: true,
            user: {
                name: user.name || currentUser.name || currentUser.email || "User",
                email: user.email || currentUser.email,
                role: user.role || currentUser.role
            }
        }, 200);

    } catch (error) {
        return c.json({ message: "Failed to retrieve profile", status: 500 }, 500);
    }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export const refreshTokenController = async (c) => {
    try {
        let refreshToken = getCookie(c, 'refresh_token');

        // Fallback: Check request body for JSON-based refresh token
        if (!refreshToken) {
            try {
                const body = await c.req.json();
                if (body && body.refresh_token) {
                    refreshToken = body.refresh_token;
                }
            } catch (e) {
                // No body or not JSON, ignore
            }
        }

        if (!refreshToken) {
            return c.json({ message: 'Refresh token missing. Please login again.', status: 401 }, 401);
        }

        const decoded = await verify(refreshToken, c.env.REFRESH_TOKEN_SECRET);

        const db = c.env.DB;
        const user = await db
            .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
            .bind(decoded.id)
            .first();

        if (!user) {
            return c.json({ message: 'User not found.', status: 401 }, 401);
        }

        const now = Math.floor(Date.now() / 1000);
        const newAccessToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            exp: now + (7 * 24 * 60 * 60)
        }, c.env.ACCESS_TOKEN_SECRET);

        // Sign a new refresh token as well to rotate it
        const newRefreshToken = await sign({ id: user.id, exp: now + (30 * 24 * 60 * 60) }, c.env.REFRESH_TOKEN_SECRET);

        const requestUrl = c.req.url;
        const isLocal = requestUrl.includes('localhost') || requestUrl.includes('127.0.0.1');
        const cookieConfig = getCookieConfig(isLocal);
        setCookie(c, 'access_token', newAccessToken, cookieConfig);
        setCookie(c, 'refresh_token', newRefreshToken, cookieConfig);

        return c.json({
            message: 'Token refreshed',
            token: newAccessToken,
            refresh_token: newRefreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            status: 200
        }, 200);

    } catch (error) {
        console.error('[Refresh Token Error]:', error);
        return c.json({ message: 'Invalid refresh token. Please login again.', status: 401 }, 401);
    }
};
