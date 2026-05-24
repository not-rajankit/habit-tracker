import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import habitsRouter from './routes/habits.js';
import entriesRouter from './routes/entries.js';
import goalsRouter from './routes/goals.js';
import summaryRouter from './routes/summary.js';
import focusSessionsRouter from './routes/focusSessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/habits', habitsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/focus-sessions', focusSessionsRouter);

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
