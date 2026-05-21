// FILE: backend/src/middlewares/auth.middleware.js
// KAAM: Access Token check karna, verify karna aur employee state injection loop execute karna
// STACK: Hono Context Layer + Web Crypto JWT Engine

import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

export const authMiddleware = async (c, next) => {
    try {
        // 1. Extract the access token seamlessly from HTTPOnly Cookies layout
        let token = getCookie(c, 'access_token');
        
        // Fallback: Check Authorization header for cross-origin/cross-port requests
        if (!token) {
            const authHeader = c.req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        
        if (!token) {
            return c.json({ message: "Unauthorized: Access token missing. Please login again.", status: 401 }, 401);
        }

        // 2. Validate environment configurations safety
        const tokenSecret = c.env.ACCESS_TOKEN_SECRET;
        if (!tokenSecret) {
            throw new Error("Critical Configuration Exception: ACCESS_TOKEN_SECRET binding missing inside memory environment");
        }

        // 3. High-performance Native Cryptographic verification loop
        // Framework explicit wrapper parameter mapping bounds automatic algorithm alignment
        const decoded = await verify(token, tokenSecret);

        // 4. Inject verified user context payload securely inside current context lifecycle loop
        // Iska fayda: Ab kisi bhi controller mein tum direct `c.get('user')` se logged-in user nikal sakte ho
        c.set('user', decoded);

        // 5. Transfer execution bounds to the next structural callback controller pipeline
        await next();

    } catch (error) {
        console.error("[Security Middleware Exception Logs]:", error.message || error);
        return c.json({ message: "Unauthorized: Invalid or expired access token architecture signature", status: 401 }, 401);
    }
};