import { Router } from 'express';
import pool from '../db.js';
import { addDays, daysInMonth, monthDateKey, parseDateKey, startOfWeek, toDateKey } from '../dateUtils.js';

const router = Router();

function buildDayDetails(dateStr, habits, entries, focusTotals = {}) {
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
    focus_seconds: Number(focusTotals[dateStr] || 0),
    completed_habits: completedHabits,
    missed_habits: missedHabits,
  };
}

async function getFocusTotalsByDate(startDate, endDate) {
  const result = await pool.query(
    `SELECT
       to_char((ended_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS date,
       COALESCE(SUM(duration_seconds), 0)::int AS total_seconds
     FROM focus_sessions
     WHERE (ended_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
       AND (ended_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
     GROUP BY (ended_at AT TIME ZONE 'Asia/Kolkata')::date`,
    [startDate, endDate]
  );

  return result.rows.reduce((totals, row) => {
    totals[row.date] = Number(row.total_seconds);
    return totals;
  }, {});
}

// GET /api/summary/weekly?date=2026-05-24
router.get('/weekly', async (req, res) => {
  try {
    const refDate = toDateKey(req.query.date || new Date());
    const startDate = startOfWeek(refDate);
    const endDate = addDays(startDate, 6);

    const habitsResult = await pool.query(
      `SELECT id, name, icon FROM habits WHERE archived = false ORDER BY created_at ASC`
    );
    const habits = habitsResult.rows;
    const totalHabits = habits.length;

    // Entries this week
    const entriesResult = await pool.query(
      `SELECT he.habit_id, to_char(he.date, 'YYYY-MM-DD') AS date, h.name, h.icon
       FROM habit_entries he
       JOIN habits h ON h.id = he.habit_id
       WHERE he.date >= $1 AND he.date <= $2 AND h.archived = false`,
      [startDate, endDate]
    );

    const totalPossible = totalHabits * 7;
    const totalCompleted = entriesResult.rows.length;
    const completionPct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    const focusTotals = await getFocusTotalsByDate(startDate, endDate);
    const totalFocusSeconds = Object.values(focusTotals).reduce((sum, value) => sum + value, 0);

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
      const dateStr = addDays(startDate, i);
      dailyBreakdown.push(buildDayDetails(dateStr, habits, entriesResult.rows, focusTotals));
    }

    res.json({
      start_date: startDate,
      end_date: endDate,
      total_completed: totalCompleted,
      total_possible: totalPossible,
      completion_percentage: completionPct,
      total_focus_seconds: totalFocusSeconds,
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
    const refDate = toDateKey(req.query.date || new Date());
    const { year, month } = parseDateKey(refDate);
    const startDate = monthDateKey(year, month, 1);
    const monthDays = daysInMonth(year, month);
    const endDate = monthDateKey(year, month, monthDays);

    const habitsResult = await pool.query(
      `SELECT id, name, icon FROM habits WHERE archived = false ORDER BY created_at ASC`
    );
    const habits = habitsResult.rows;
    const totalHabits = habits.length;

    const entriesResult = await pool.query(
      `SELECT he.habit_id, to_char(he.date, 'YYYY-MM-DD') AS date, h.name, h.icon FROM habit_entries he
       JOIN habits h ON h.id = he.habit_id
       WHERE he.date >= $1 AND he.date <= $2 AND h.archived = false`,
      [startDate, endDate]
    );

    const totalPossible = totalHabits * monthDays;
    const totalCompleted = entriesResult.rows.length;
    const completionPct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    const focusTotals = await getFocusTotalsByDate(startDate, endDate);
    const totalFocusSeconds = Object.values(focusTotals).reduce((sum, value) => sum + value, 0);

    // Days with at least one completion
    const uniqueDays = new Set(entriesResult.rows.map(e => e.date));
    const successfulDays = uniqueDays.size;

    // Calendar data (day → count)
    const calendar = {};
    const dailyDetails = {};
    for (let d = 1; d <= monthDays; d++) {
      const dateStr = monthDateKey(year, month, d);
      calendar[dateStr] = 0;
      dailyDetails[dateStr] = buildDayDetails(dateStr, habits, entriesResult.rows, focusTotals);
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
      month: `${year}-${String(month).padStart(2, '0')}`,
      total_completed: totalCompleted,
      total_possible: totalPossible,
      completion_percentage: completionPct,
      total_focus_seconds: totalFocusSeconds,
      successful_days: successfulDays,
      days_in_month: monthDays,
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
