// FILE: backend/src/controllers/auth.controller.js
// V3 - COOKIE MAX-AGE MATCHING & STRICT CORS SECURED

import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie } from 'hono/cookie';

// Dynamic expiry pass-through configuration
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
        const assignedRole = 'employee';

        const result = await db
            .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
            .bind(name.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole)
            .run();

        if (result.meta.changes === 0) {
            throw new Error("Database insertion failed");
        }

        return c.json({ message: "User registered successfully", success: true }, 201);

    } catch (error) {
        console.error("[Register Error]:", error);
        return c.json({ message: error.message || "Internal Server Error", status: 500 }, 500);
    }
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────
export const loginController = async (c) => {
    try {
        const { email, password } = await c.req.json();
        const db = c.env.DB;

        const identifier = (email || '').toLowerCase().trim();

        if (!identifier || !password) {
            return c.json({ message: "Email and password required", status: 400 }, 400);
        }

        const user = await db
            .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
            .bind(identifier)
            .first();

        if (!user) {
            return c.json({ message: "Invalid credentials", status: 401 }, 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return c.json({ message: "Invalid credentials", status: 401 }, 401);
        }

        if (!c.env.ACCESS_TOKEN_SECRET || !c.env.REFRESH_TOKEN_SECRET) {
            console.error("[CRITICAL] JWT secrets missing!");
            return c.json({ message: "Server configuration error", status: 500 }, 500);
        }

        const now = Math.floor(Date.now() / 1000);
        const ACCESS_EXPIRY = 15 * 60;          // 15 Min
        const REFRESH_EXPIRY = 7 * 24 * 60 * 60; // 7 Days

        const accessToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            exp: now + ACCESS_EXPIRY
        }, c.env.ACCESS_TOKEN_SECRET);

        const refreshToken = await sign({
            id: user.id,
            exp: now + REFRESH_EXPIRY
        }, c.env.REFRESH_TOKEN_SECRET);

        // Bind cookies strictly to their real token lifetime values
        setCookie(c, 'access_token', accessToken, getCookieConfig(c, ACCESS_EXPIRY));
        setCookie(c, 'refresh_token', refreshToken, getCookieConfig(c, REFRESH_EXPIRY));

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
        const currentUser = c.get('user');
        if (currentUser.role !== 'admin') {
            return c.json({ message: "Access denied: Admin only", status: 403 }, 403);
        }

        const db = c.env.DB;
        const { results } = await db
            .prepare("SELECT id, email, name, role, created_at FROM users")
            .all();

        return c.json({ total_users: results.length, users: results, success: true }, 200);

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
                name: user.name || currentUser.name || "User",
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

        if (!refreshToken) {
            try {
                const body = await c.req.json();
                if (body?.refresh_token) {
                    refreshToken = body.refresh_token;
                }
            } catch (e) {}
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
        const ACCESS_EXPIRY = 15 * 60;
        const REFRESH_EXPIRY = 7 * 24 * 60 * 60;

        const newAccessToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            exp: now + ACCESS_EXPIRY
        }, c.env.ACCESS_TOKEN_SECRET);

        const newRefreshToken = await sign({
            id: user.id,
            exp: now + REFRESH_EXPIRY
        }, c.env.REFRESH_TOKEN_SECRET);

        setCookie(c, 'access_token', newAccessToken, getCookieConfig(c, ACCESS_EXPIRY));
        setCookie(c, 'refresh_token', newRefreshToken, getCookieConfig(c, REFRESH_EXPIRY));

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


