import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/habits — list all active habits with today's completion status & streaks
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT
        h.*,
        CASE WHEN he.id IS NOT NULL THEN true ELSE false END AS completed_today
      FROM habits h
      LEFT JOIN habit_entries he ON he.habit_id = h.id AND he.date = $1
      WHERE h.archived = false
      ORDER BY h.sort_order ASC NULLS LAST, h.created_at ASC, h.id ASC
    `, [today]);

    // Calculate streaks for each habit
    const habits = await Promise.all(result.rows.map(async (habit) => {
      const streaks = await calculateStreaks(habit.id, habit.frequency);
      return {
        ...habit,
        current_streak: streaks.current,
        best_streak: streaks.best,
      };
    }));

    res.json(habits);
  } catch (err) {
    console.error('Error fetching habits:', err);
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
});

// POST /api/habits — create a habit
router.post('/', async (req, res) => {
  try {
    const { name, frequency = 'daily', icon = '✅', category } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `WITH next_order AS (
         SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM habits
       )
       INSERT INTO habits (name, frequency, icon, category, sort_order)
       SELECT $1, $2, $3, $4, value FROM next_order
       RETURNING *`,
      [name, frequency, icon, category || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating habit:', err);
    res.status(500).json({ error: 'Failed to create habit' });
  }
});

// PUT /api/habits/order — update table order
router.put('/order', async (req, res) => {
  const client = await pool.connect();
  try {
    const { habit_ids } = req.body;
    if (!Array.isArray(habit_ids)) {
      return res.status(400).json({ error: 'habit_ids must be an array' });
    }

    await client.query('BEGIN');
    for (let index = 0; index < habit_ids.length; index++) {
      await client.query(
        `UPDATE habits SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
        [index + 1, habit_ids[index]]
      );
    }
    await client.query('COMMIT');
    res.json({ habit_ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating habit order:', err);
    res.status(500).json({ error: 'Failed to update habit order' });
  } finally {
    client.release();
  }
});

// PUT /api/habits/:id — update a habit
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, frequency, icon, category } = req.body;
    const result = await pool.query(
      `UPDATE habits SET
        name = COALESCE($1, name),
        frequency = COALESCE($2, frequency),
        icon = COALESCE($3, icon),
        category = COALESCE($4, category),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, frequency, icon, category, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating habit:', err);
    res.status(500).json({ error: 'Failed to update habit' });
  }
});

// DELETE /api/habits/:id — archive (soft-delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE habits SET archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json({ message: 'Habit archived' });
  } catch (err) {
    console.error('Error archiving habit:', err);
    res.status(500).json({ error: 'Failed to archive habit' });
  }
});

// ── Streak calculator ──
async function calculateStreaks(habitId, frequency) {
  const entries = await pool.query(
    `SELECT date FROM habit_entries WHERE habit_id = $1 ORDER BY date DESC`,
    [habitId]
  );

  if (entries.rows.length === 0) return { current: 0, best: 0 };

  const dates = entries.rows.map(r => r.date.toISOString().split('T')[0]);

  if (frequency === 'daily') {
    return calculateDailyStreaks(dates);
  } else {
    return calculateWeeklyStreaks(dates);
  }
}

function calculateDailyStreaks(dates) {
  let current = 0;
  let best = 0;
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];

  // Check if today or yesterday is in the list to start current streak
  const dateSet = new Set(dates);
  let checkDate = new Date();

  // If today isn't completed, start from yesterday
  if (!dateSet.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count current streak
  while (true) {
    const d = checkDate.toISOString().split('T')[0];
    if (dateSet.has(d)) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Count best streak
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        streak = 1;
      }
    }
    best = Math.max(best, streak);
  }

  return { current, best: Math.max(best, current) };
}

function calculateWeeklyStreaks(dates) {
  if (dates.length === 0) return { current: 0, best: 0 };

  // Group by ISO week
  const weeks = new Set();
  dates.forEach(d => {
    const date = new Date(d);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date - startOfYear) / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7);
    weeks.add(`${date.getFullYear()}-W${weekNum}`);
  });

  const sortedWeeks = Array.from(weeks).sort().reverse();
  let current = 1;
  let best = 1;
  let streak = 1;

  for (let i = 1; i < sortedWeeks.length; i++) {
    const [y1, w1] = sortedWeeks[i - 1].split('-W').map(Number);
    const [y2, w2] = sortedWeeks[i].split('-W').map(Number);
    if ((y1 === y2 && w1 - w2 === 1) || (y1 - y2 === 1 && w2 === 52 && w1 === 1)) {
      streak++;
    } else {
      streak = 1;
    }
    if (i === 1) current = streak;
    best = Math.max(best, streak);
  }

  return { current, best };
}

export default router;
