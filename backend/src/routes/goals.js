import { Router } from 'express';
import pool from '../db.js';
import { toDateKey } from '../dateUtils.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function validateLinkedHabitIds(userId, ids = []) {
  if (!Array.isArray(ids)) return [];
  const uniqueIds = [...new Set(ids.map(String).filter((id) => UUID_RE.test(id)))];
  if (uniqueIds.length !== ids.length) {
    throw new Error('Linked habit IDs must be valid UUIDs.');
  }
  if (uniqueIds.length === 0) return [];

  const result = await pool.query(
    `SELECT id FROM habits WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, uniqueIds]
  );
  if (result.rows.length !== uniqueIds.length) {
    throw new Error('One or more linked habits were not found.');
  }
  return uniqueIds;
}

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Calculate progress for small goals with linked habits
    const goals = await Promise.all(result.rows.map(async (goal) => {
      let progress = 0;
      if (goal.type === 'small' && goal.linked_habit_ids?.length > 0 && goal.deadline) {
        const startDate = toDateKey(goal.created_at);
        const endDate = goal.deadline;
        const entriesResult = await pool.query(
          `SELECT COUNT(*) as count
           FROM habit_entries he
           JOIN habits h ON h.id = he.habit_id
           WHERE he.habit_id = ANY($1::uuid[])
             AND h.user_id = $2
             AND he.date >= $3
             AND he.date <= $4`,
          [goal.linked_habit_ids, req.user.id, startDate, endDate]
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
    const linkedHabitIds = await validateLinkedHabitIds(req.user.id, linked_habit_ids);

    const result = await pool.query(
      `INSERT INTO goals (type, title, description, target, deadline, linked_habit_ids, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [type, title, description || null, target, deadline || null, JSON.stringify(linkedHabitIds), req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating goal:', err);
    res.status(err.message?.includes('Linked habit') || err.message?.includes('not found') ? 400 : 500)
      .json({ error: err.message || 'Failed to create goal' });
  }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, description, target, deadline, linked_habit_ids } = req.body;
    const linkedHabitIds = linked_habit_ids === undefined
      ? undefined
      : await validateLinkedHabitIds(req.user.id, linked_habit_ids);
    const result = await pool.query(
      `UPDATE goals SET
        type = COALESCE($1, type),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        target = COALESCE($4, target),
        deadline = COALESCE($5, deadline),
        linked_habit_ids = COALESCE($6, linked_habit_ids),
        updated_at = NOW()
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [type, title, description, target, deadline, linkedHabitIds ? JSON.stringify(linkedHabitIds) : null, id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating goal:', err);
    res.status(err.message?.includes('Linked habit') || err.message?.includes('not found') ? 400 : 500)
      .json({ error: err.message || 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id`, [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    console.error('Error deleting goal:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
