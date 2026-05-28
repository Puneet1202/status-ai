// FILE: backend/src/routers/timesheet.routes.js
// KAAM: Clean Route Mapping for Timesheet Infrastructure Pipeline

import { Hono } from 'hono';
import { addTimesheetEntry, getAllTimesheetsAdmin, deleteTimesheetEntry, aiChatHandler, getProjects } from '../controllers/timesheet.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const timesheetRouter = new Hono();

// AuthMiddleware strictly guards session tokens across endpoints execution loops
timesheetRouter.post('/submit', authMiddleware, addTimesheetEntry);
timesheetRouter.get('/admin/all-logs', authMiddleware, getAllTimesheetsAdmin);

// FIX: Path ko clean karke strictly '/delete/:id' rakha hai, Hono index prefix automatic handles karega
timesheetRouter.delete('/delete/:id', authMiddleware, deleteTimesheetEntry);

// AI-INTEGRATED TIMESHEET ENDPOINT
timesheetRouter.post('/ai/chat', authMiddleware, aiChatHandler);

timesheetRouter.get('/projects', authMiddleware, getProjects);



export default timesheetRouter;