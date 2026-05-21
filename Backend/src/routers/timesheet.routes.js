// FILE: backend/src/routers/timesheet.routes.js
import { Hono } from 'hono';
import { addTimesheetEntry, getAllTimesheetsAdmin } from '../controllers/timesheet.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const timesheetRouter = new Hono();

// AuthMiddleware strictly guards session tokens across endpoints execution loops
timesheetRouter.post('/submit', authMiddleware, addTimesheetEntry);
timesheetRouter.get('/admin/all-logs', authMiddleware, getAllTimesheetsAdmin);

export default timesheetRouter;