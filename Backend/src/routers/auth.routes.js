// FILE: backend/src/routers/auth.routes.js
// OTP login routes — aligned to prod.db (no password endpoints).

import { Hono } from 'hono';
import {
    requestOtpController,
    verifyOtpController,
    getProfileHandler,
    refreshTokenController,
    getAllUsers,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const authRouter = new Hono();

// Public — no token needed (this is how a user logs in).
authRouter.post('/request-otp', requestOtpController); // email → emailed 6-digit code
authRouter.post('/verify-otp', verifyOtpController);    // email + code → access/refresh JWT
authRouter.post('/refresh', refreshTokenController);    // rotate tokens

// Protected — require a valid access token.
authRouter.get('/users', authMiddleware, getAllUsers);
authRouter.get('/me', authMiddleware, getProfileHandler);

export default authRouter;
