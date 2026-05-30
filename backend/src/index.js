import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRouter from './authentication/routes.js';
import { authenticate } from './authentication/middleware.js';
import habitsRouter from './routes/habits.js';
import entriesRouter from './routes/entries.js';
import goalsRouter from './routes/goals.js';
import summaryRouter from './routes/summary.js';
import focusSessionsRouter from './routes/focusSessions.js';
import templatesRouter from './routes/templates.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/habits', authenticate, habitsRouter);
app.use('/api/entries', authenticate, entriesRouter);
app.use('/api/goals', authenticate, goalsRouter);
app.use('/api/summary', authenticate, summaryRouter);
app.use('/api/focus-sessions', authenticate, focusSessionsRouter);
app.use('/api/templates', authenticate, templatesRouter);
app.use('/api/admin', authenticate, adminRouter);

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Serve the built frontend when it exists, so production can run from one server.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Habit Tracker API running on http://localhost:${PORT}`);
});
