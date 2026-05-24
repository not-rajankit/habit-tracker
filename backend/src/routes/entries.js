import { Router } from 'express';
import pool from '../db.js';

const router = Router();

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/entries/toggle — toggle habit completion for a date
router.post('/toggle', async (req, res) => {
  try {
    const { habit_id, date } = req.body;
    if (!habit_id) return res.status(400).json({ error: 'habit_id is required' });

    const entryDate = date || toLocalDateKey();

    // Check if entry exists
    const existing = await pool.query(
      `SELECT id FROM habit_entries WHERE habit_id = $1 AND date = $2`,
      [habit_id, entryDate]
    );

    if (existing.rows.length > 0) {
      // Unmark
      await pool.query(`DELETE FROM habit_entries WHERE id = $1`, [existing.rows[0].id]);
      res.json({ completed: false, date: entryDate });
    } else {
      // Mark
      await pool.query(
        `INSERT INTO habit_entries (habit_id, date) VALUES ($1, $2)`,
        [habit_id, entryDate]
      );
      res.json({ completed: true, date: entryDate });
    }
  } catch (err) {
    console.error('Error toggling entry:', err);
    res.status(500).json({ error: 'Failed to toggle entry' });
  }
});

// GET /api/entries?habit_id=&start_date=&end_date=
router.get('/', async (req, res) => {
  try {
    const { habit_id, start_date, end_date } = req.query;
    let query = `SELECT id, habit_id, to_char(date, 'YYYY-MM-DD') AS date, created_at FROM habit_entries WHERE 1=1`;
    const params = [];

    if (habit_id) {
      params.push(habit_id);
      query += ` AND habit_id = $${params.length}`;
    }
    if (start_date) {
      params.push(start_date);
      query += ` AND date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND date <= $${params.length}`;
    }

    query += ` ORDER BY date DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching entries:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

export default router;
