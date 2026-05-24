import { Router } from 'express';
import pool from '../db.js';
import { toDateKey } from '../dateUtils.js';

const router = Router();

function mapSession(row) {
  return {
    ...row,
    date: toDateKey(row.date),
    duration_seconds: Number(row.duration_seconds),
  };
}

// GET /api/focus-sessions?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const date = toDateKey(req.query.date || new Date());
    const result = await pool.query(
      `SELECT
         id,
         preset_name,
         duration_seconds,
         started_at,
         ended_at,
         (ended_at AT TIME ZONE 'Asia/Kolkata')::date AS date,
         created_at
       FROM focus_sessions
       WHERE (ended_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date
       ORDER BY ended_at DESC`,
      [date]
    );

    res.json({
      date,
      total_seconds: result.rows.reduce((sum, row) => sum + Number(row.duration_seconds), 0),
      sessions: result.rows.map(mapSession),
    });
  } catch (err) {
    console.error('Error fetching focus sessions:', err);
    res.status(500).json({ error: 'Failed to fetch focus sessions' });
  }
});

// POST /api/focus-sessions
router.post('/', async (req, res) => {
  try {
    const { preset_name, duration_seconds, started_at, ended_at } = req.body;
    const duration = Number(duration_seconds);

    if (!preset_name) return res.status(400).json({ error: 'preset_name is required' });
    if (!Number.isInteger(duration) || duration <= 0) {
      return res.status(400).json({ error: 'duration_seconds must be a positive integer' });
    }

    const startedAt = started_at ? new Date(started_at) : new Date(Date.now() - duration * 1000);
    const endedAt = ended_at ? new Date(ended_at) : new Date();

    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
      return res.status(400).json({ error: 'Invalid session timestamp' });
    }

    const result = await pool.query(
      `INSERT INTO focus_sessions (preset_name, duration_seconds, started_at, ended_at)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         preset_name,
         duration_seconds,
         started_at,
         ended_at,
         (ended_at AT TIME ZONE 'Asia/Kolkata')::date AS date,
         created_at`,
      [preset_name, duration, startedAt.toISOString(), endedAt.toISOString()]
    );

    res.status(201).json(mapSession(result.rows[0]));
  } catch (err) {
    console.error('Error creating focus session:', err);
    res.status(500).json({ error: 'Failed to create focus session' });
  }
});

// DELETE /api/focus-sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM focus_sessions WHERE id = $1 RETURNING id`, [
      req.params.id,
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Focus session not found' });
    res.json({ message: 'Focus session deleted' });
  } catch (err) {
    console.error('Error deleting focus session:', err);
    res.status(500).json({ error: 'Failed to delete focus session' });
  }
});

export default router;
