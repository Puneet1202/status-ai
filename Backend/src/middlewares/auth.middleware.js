// FILE: backend/src/middlewares/auth.middleware.js
// KAAM: Token verify + identity resolve.
//
// Token chahe IS app ke apne login se aaye, ya SIR ki website (react-keyss-status,
// Next.js) ke login se — dono ka DB SAME hai (keyss-status.prod.db). Isliye hum
// token se SIRF user id lete hai aur poori pehchaan (role, employee_id, naam)
// SHARED DB se nikaalte hai.
//
// FAYDA: claim-naam ka farak apne aap handle ho jata hai —
//   • sir ka token deta hai: employeeId / clientId / roleId (camelCase, roleId = number)
//   • ye AI maangta hai:      employee_id / client_id / role (snake_case, role = string)
// DB se resolve karne se AI ko hamesha uska apna format milta hai, aur sir ka code
// bilkul change nahi karna padta.

import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

export const authMiddleware = async (c, next) => {
    try {
        // 1. Token nikaalo: pehle Authorization header (Bearer ...), warna cookie.
        const authHeader = c.req.header('Authorization');
        let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        if (!token) token = getCookie(c, 'access_token');   // is app ke apne login ki cookie
        if (!token) token = getCookie(c, 'auth_token');     // sir ki website wali cookie (fallback)

        if (!token) {
            return c.json({ message: "Unauthorized: Missing active session token", success: false }, 401);
        }

        // 2. Signature verify (HS256). Secret = ACCESS_TOKEN_SECRET, jo SIR ke
        //    JWT_SECRET ke BARABAR hona chahiye (.env me set kiya gaya).
        const payload = await verify(token, c.env.ACCESS_TOKEN_SECRET, 'HS256');

        // 3. User id token se (har login alag naam deta hai):
        //    - is app ka token  → id
        //    - sir ka token     → sub (ya legacy userId)
        const userId = Number(payload.id ?? payload.sub ?? payload.userId);

        // 4. Poori pehchaan SHARED DB se nikaalo — taaki role/employee_id hamesha
        //    is app ke apne format me mile, chahe token kisi bhi site se aaya ho.
        //    (Yeh wahi query hai jo is app ka apna login use karta hai.)
        let user = null;
        if (userId && !Number.isNaN(userId) && c.env.DB) {
            user = await c.env.DB
                .prepare(
                    `SELECT u.id, u.email, u.employee_id, u.client_id, u.is_active,
                            r.name AS role, COALESCE(e.name, '') AS name
                       FROM users u
                       JOIN roles r         ON r.id = u.role_id
                       LEFT JOIN employee e ON e.id = u.employee_id
                      WHERE u.id = ?`
                )
                .bind(userId)
                .first();
        }

        // 5. Graceful fallback: agar DB me na mile, to token ke fields se hi kaam
        //    chala lo — camelCase ko snake_case me map karke.
        if (!user) {
            user = {
                id: userId,
                email: payload.email,
                role: payload.role,
                name: payload.name,
                employee_id: payload.employee_id ?? payload.employeeId ?? null,
                client_id: payload.client_id ?? payload.clientId ?? null,
            };
        }

        // Disabled account → reject.
        if (user.is_active === 0) {
            return c.json({ message: "Unauthorized: Account inactive", success: false }, 401);
        }

        // Context storage mapping for downstream controllers access
        c.set('user', user);
        await next();

    } catch (error) {
        console.error("[Security Middleware Exception Logs]:", error.message || error);
        return c.json({
            message: "Unauthorized: Invalid or expired access token architecture signature",
            success: false
        }, 401);
    }
};
