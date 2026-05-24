import { Router } from 'express';
import pool from '../db.js';
import { toDateKey } from '../dateUtils.js';

const router = Router();

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM goals ORDER BY created_at DESC`);

    // Calculate progress for small goals with linked habits
    const goals = await Promise.all(result.rows.map(async (goal) => {
      let progress = 0;
      if (goal.type === 'small' && goal.linked_habit_ids?.length > 0 && goal.deadline) {
        const startDate = toDateKey(goal.created_at);
        const endDate = goal.deadline;
        const entriesResult = await pool.query(
          `SELECT COUNT(*) as count FROM habit_entries
           WHERE habit_id = ANY($1::int[]) AND date >= $2 AND date <= $3`,
          [goal.linked_habit_ids, startDate, endDate]
        );
        progress = parseInt(entriesResult.rows[0].count) || 0;
      }
      return { ...goal, progress };
    }));

    res.json(goals);
  } catch (err) {
    console.error('Error fetching goals:', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const { type = 'small', title, description, target = 1, deadline, linked_habit_ids = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await pool.query(
      `INSERT INTO goals (type, title, description, target, deadline, linked_habit_ids)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [type, title, description || null, target, deadline || null, JSON.stringify(linked_habit_ids)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating goal:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, description, target, deadline, linked_habit_ids } = req.body;
    const result = await pool.query(
      `UPDATE goals SET
        type = COALESCE($1, type),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        target = COALESCE($4, target),
        deadline = COALESCE($5, deadline),
        linked_habit_ids = COALESCE($6, linked_habit_ids),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [type, title, description, target, deadline, linked_habit_ids ? JSON.stringify(linked_habit_ids) : null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating goal:', err);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM goals WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    console.error('Error deleting goal:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
