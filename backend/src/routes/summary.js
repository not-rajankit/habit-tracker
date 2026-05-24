import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/summary/weekly?date=2026-05-24
router.get('/weekly', async (req, res) => {
  try {
    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    const day = refDate.getDay();
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = monday.toISOString().split('T')[0];
    const endDate = sunday.toISOString().split('T')[0];

    // Total habits (active)
    const habitsResult = await pool.query(
      `SELECT COUNT(*) as count FROM habits WHERE archived = false`
    );
    const totalHabits = parseInt(habitsResult.rows[0].count) || 0;

    // Entries this week
    const entriesResult = await pool.query(
      `SELECT he.habit_id, he.date, h.name, h.icon
       FROM habit_entries he
       JOIN habits h ON h.id = he.habit_id
       WHERE he.date >= $1 AND he.date <= $2 AND h.archived = false`,
      [startDate, endDate]
    );

    const totalPossible = totalHabits * 7;
    const totalCompleted = entriesResult.rows.length;
    const completionPct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    // Best and weakest habits
    const habitCounts = {};
    entriesResult.rows.forEach(e => {
      const key = `${e.habit_id}`;
      if (!habitCounts[key]) habitCounts[key] = { name: e.name, icon: e.icon, count: 0 };
      habitCounts[key].count++;
    });

    const sorted = Object.values(habitCounts).sort((a, b) => b.count - a.count);
    const best = sorted[0] || null;
    const weakest = sorted[sorted.length - 1] || null;

    // Daily breakdown
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const count = entriesResult.rows.filter(e => {
        const ed = e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date;
        return ed === dateStr;
      }).length;
      dailyBreakdown.push({ date: dateStr, completed: count, total: totalHabits });
    }

    res.json({
      start_date: startDate,
      end_date: endDate,
      total_completed: totalCompleted,
      total_possible: totalPossible,
      completion_percentage: completionPct,
      best_habit: best,
      weakest_habit: weakest,
      daily_breakdown: dailyBreakdown,
    });
  } catch (err) {
    console.error('Error fetching weekly summary:', err);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// GET /api/summary/monthly?date=2026-05-01
router.get('/monthly', async (req, res) => {
  try {
    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const habitsResult = await pool.query(
      `SELECT id, name, icon FROM habits WHERE archived = false`
    );
    const habits = habitsResult.rows;
    const totalHabits = habits.length;

    const entriesResult = await pool.query(
      `SELECT he.habit_id, he.date FROM habit_entries he
       JOIN habits h ON h.id = he.habit_id
       WHERE he.date >= $1 AND he.date <= $2 AND h.archived = false`,
      [startDate, endDate]
    );

    const totalPossible = totalHabits * daysInMonth;
    const totalCompleted = entriesResult.rows.length;
    const completionPct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    // Days with at least one completion
    const uniqueDays = new Set(entriesResult.rows.map(e => {
      return e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date;
    }));
    const successfulDays = uniqueDays.size;

    // Calendar data (day → count)
    const calendar = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendar[dateStr] = 0;
    }
    entriesResult.rows.forEach(e => {
      const dateStr = e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date;
      if (calendar[dateStr] !== undefined) calendar[dateStr]++;
    });

    // Most consistent habit
    const habitCounts = {};
    entriesResult.rows.forEach(e => {
      habitCounts[e.habit_id] = (habitCounts[e.habit_id] || 0) + 1;
    });
    let mostConsistent = null;
    let maxCount = 0;
    for (const [hid, count] of Object.entries(habitCounts)) {
      if (count > maxCount) {
        maxCount = count;
        const h = habits.find(h => h.id === parseInt(hid));
        if (h) mostConsistent = { ...h, count };
      }
    }

    res.json({
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      total_completed: totalCompleted,
      total_possible: totalPossible,
      completion_percentage: completionPct,
      successful_days: successfulDays,
      days_in_month: daysInMonth,
      most_consistent_habit: mostConsistent,
      calendar,
    });
  } catch (err) {
    console.error('Error fetching monthly summary:', err);
    res.status(500).json({ error: 'Failed to fetch monthly summary' });
  }
});

export default router;
