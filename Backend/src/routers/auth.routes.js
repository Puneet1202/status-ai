import { Hono } from 'hono';
import { registerController, loginController, getAllUsers, getProfileHandler, refreshTokenController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const authRouter = new Hono();

// 1. In par middleware NAHI lagega (Kyunki yahan user bina login ke aata hai)
authRouter.post('/signup', registerController);
authRouter.post('/login', loginController);
authRouter.post('/refresh', refreshTokenController); // Refresh token se naya access token lo

// 2. Is par middleware LAGEGA
authRouter.get('/users', authMiddleware, getAllUsers);
authRouter.get('/me', authMiddleware, getProfileHandler);

export default authRouter;