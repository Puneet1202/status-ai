// FILE: backend/src/routers/timesheet.routes.js
// KAAM: Clean Route Mapping for Timesheet Infrastructure Pipeline

import { Hono } from 'hono';
import { addTimesheetEntry, getAllTimesheetsAdmin, deleteTimesheetEntry, aiChatHandler, getProjects, getProjectTasksController, submitAiFeedback, rateAiChatLog } from '../controllers/timesheet.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const timesheetRouter = new Hono();

// AuthMiddleware strictly guards session tokens across endpoints execution loops
timesheetRouter.post('/submit', authMiddleware, addTimesheetEntry);
timesheetRouter.get('/admin/all-logs', authMiddleware, getAllTimesheetsAdmin);

// FIX: Path ko clean karke strictly '/delete/:id' rakha hai, Hono index prefix automatic handles karega
timesheetRouter.delete('/delete/:id', authMiddleware, deleteTimesheetEntry);

// AI-INTEGRATED TIMESHEET ENDPOINT
timesheetRouter.post('/ai/chat', authMiddleware, aiChatHandler);

// "Report" — save a snapshot of the recent chat when the AI replied wrong
timesheetRouter.post('/ai/report', authMiddleware, submitAiFeedback);

// Per-message 👍/👎 (data ko usable banata)
timesheetRouter.post('/ai/chat-feedback', authMiddleware, rateAiChatLog);

timesheetRouter.get('/projects', authMiddleware, getProjects);


// Route sirf url map karega, asli kaam controller karega
timesheetRouter.get('/projects/:id/tasks', authMiddleware, getProjectTasksController);


export default timesheetRouter;