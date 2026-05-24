import { Router } from 'express';
import pool from '../db.js';

const router = Router();

function toDateKey(date) {
  return date instanceof Date ? date.toISOString().split('T')[0] : date;
}

function buildDayDetails(dateStr, habits, entries) {
  const completedIds = new Set(
    entries
      .filter(e => toDateKey(e.date) === dateStr)
      .map(e => e.habit_id)
  );
  const completedHabits = habits
    .filter(h => completedIds.has(h.id))
    .map(h => ({ id: h.id, name: h.name, icon: h.icon }));
  const missedHabits = habits
    .filter(h => !completedIds.has(h.id))
    .map(h => ({ id: h.id, name: h.name, icon: h.icon }));
  const total = habits.length;
  const completed = completedHabits.length;

  return {
    date: dateStr,
    completed,
    total,
    completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    completed_habits: completedHabits,
    missed_habits: missedHabits,
  };
}

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

    const habitsResult = await pool.query(
      `SELECT id, name, icon FROM habits WHERE archived = false ORDER BY created_at ASC`
    );
    const habits = habitsResult.rows;
    const totalHabits = habits.length;

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
      dailyBreakdown.push(buildDayDetails(dateStr, habits, entriesResult.rows));
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
      daily_details: dailyBreakdown,
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
      `SELECT id, name, icon FROM habits WHERE archived = false ORDER BY created_at ASC`
    );
    const habits = habitsResult.rows;
    const totalHabits = habits.length;

    const entriesResult = await pool.query(
      `SELECT he.habit_id, he.date, h.name, h.icon FROM habit_entries he
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
    const dailyDetails = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendar[dateStr] = 0;
      dailyDetails[dateStr] = buildDayDetails(dateStr, habits, entriesResult.rows);
    }
    entriesResult.rows.forEach(e => {
      const dateStr = toDateKey(e.date);
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
      daily_details: dailyDetails,
    });
  } catch (err) {
    console.error('Error fetching monthly summary:', err);
    res.status(500).json({ error: 'Failed to fetch monthly summary' });
  }
});

export default router;
