// FILE: backend/src/middlewares/auth.middleware.js
// KAAM: Secure Session Verification + Algorithm Specification Guard Token Fix

import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

export const authMiddleware = async (c, next) => {
    try {
        // 1. Extract from Authorization Header
        const authHeader = c.req.header('Authorization');
        let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        // 2. Fallback: Extract from Cookie if header is missing
        if (!token) {
            token = getCookie(c, 'access_token');
        }

        if (!token) {
            return c.json({ message: "Unauthorized: Missing active session token", success: false }, 401);
        }

        // 3. Cryptographic Signature Verification WITH MANDATORY ALGORITHM SPECIFIED
        // FIX: Explicitly passing 'HS256' string algorithm parameter as required by new Hono Core standard engines
        const decodedPayload = await verify(token, c.env.ACCESS_TOKEN_SECRET, 'HS256');
        
        // Context storage mapping for downstream controllers access
        c.set('user', decodedPayload);
        await next();

    } catch (error) {
        console.error("[Security Middleware Exception Logs]:", error.message || error);
        return c.json({ 
            message: "Unauthorized: Invalid or expired access token architecture signature", 
            success: false 
        }, 401);
    }
};