import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEntries, getHabits, toggleEntry } from '../api';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateKey(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const day = date.getDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

function buildWeekDays(offset) {
  const base = addDays(startOfWeek(new Date()), offset * 7);
  return Array.from({ length: 7 }, (_, index) => addDays(base, index));
}

function buildMonthDays(offset) {
  const today = new Date();
  const monthDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1)
  );
}

export default function HabitTable() {
  const [mode, setMode] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');

  const days = useMemo(
    () => (mode === 'week' ? buildWeekDays(periodOffset) : buildMonthDays(periodOffset)),
    [mode, periodOffset]
  );

  const startDate = toDateKey(days[0]);
  const endDate = toDateKey(days[days.length - 1]);
  const todayKey = toDateKey(new Date());

  const dailyHabits = useMemo(
    () => habits.filter((habit) => habit.frequency === 'daily'),
    [habits]
  );

  const completedKeys = useMemo(() => {
    const keys = new Set();
    entries.forEach((entry) => {
      const date = entry.date?.split?.('T')[0] || entry.date;
      keys.add(`${entry.habit_id}-${date}`);
    });
    return keys;
  }, [entries]);

  const dayStats = useMemo(() => {
    const stats = {};
    days.forEach((day) => {
      const dateKey = toDateKey(day);
      const completed = dailyHabits.filter((habit) =>
        completedKeys.has(`${habit.id}-${dateKey}`)
      ).length;
      stats[dateKey] = {
        completed,
        total: dailyHabits.length,
        ratio: dailyHabits.length > 0 ? completed / dailyHabits.length : 0,
      };
    });
    return stats;
  }, [completedKeys, dailyHabits, days]);

  const title = useMemo(() => {
    if (mode === 'week') return `${startDate} to ${endDate}`;
    const monthDate = days[0];
    return `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  }, [days, endDate, mode, startDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [habitData, entryData] = await Promise.all([
        getHabits(),
        getEntries({ start_date: startDate, end_date: endDate }),
      ]);
      setHabits(habitData);
      setEntries(entryData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setPeriodOffset(0);
  };

  const getHeaderHeatClass = (ratio) => {
    if (ratio >= 0.8) return 'bg-green-100 text-green-800';
    if (ratio >= 0.5) return 'bg-green-50 text-green-700';
    if (ratio > 0) return 'bg-emerald-50 text-emerald-600';
    return 'bg-surface-100 text-gray-400';
  };

  const handleToggle = async (habitId, date) => {
    const key = `${habitId}-${date}`;
    setSavingKey(key);
    try {
      await toggleEntry(habitId, date);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Habit Table</h1>
          <p className="text-xs text-gray-400 mt-1">{title}</p>
        </div>
        <div className="flex rounded-xl bg-surface-100 p-1 shrink-0">
          {['week', 'month'].map((option) => (
            <button
              key={option}
              onClick={() => handleModeChange(option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                mode === option ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setPeriodOffset((offset) => offset - 1)}
          className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-gray-500 hover:bg-surface-200"
        >
          ←
        </button>
        <button
          onClick={() => setPeriodOffset(0)}
          className="px-4 py-2 rounded-xl bg-white border border-surface-200 text-xs font-semibold text-gray-500 shadow-sm"
        >
          Current {mode}
        </button>
        <button
          onClick={() => setPeriodOffset((offset) => offset + 1)}
          disabled={periodOffset >= 0}
          className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-gray-500 hover:bg-surface-200 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {dailyHabits.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">▦</div>
          <h3 className="text-lg font-semibold text-gray-700">No daily habits</h3>
          <p className="text-sm text-gray-400 mt-1">Daily habits will appear as rows here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto sm:overflow-visible">
          <div className="min-w-[640px] rounded-2xl border border-surface-200/70 bg-white p-3 shadow-sm sm:min-w-0 sm:p-4">
            <div
              className="grid items-center gap-x-1 gap-y-2 sm:gap-x-1.5"
              style={{
                gridTemplateColumns: mode === 'month'
                  ? `minmax(88px, 1.7fr) repeat(${days.length}, minmax(0, 1fr))`
                  : `minmax(116px, 1.7fr) repeat(${days.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Habit
              </div>

              {days.map((day) => {
                const dateKey = toDateKey(day);
                const isToday = dateKey === todayKey;
                const isWeekEnd = day.getDay() === 0 && dateKey !== endDate;
                const stats = dayStats[dateKey];
                return (
                  <div
                    key={dateKey}
                    className={`rounded-lg py-1 text-center ${getHeaderHeatClass(stats?.ratio || 0)} ${
                      isToday ? 'ring-2 ring-brand-400 ring-offset-1' : ''
                    } ${isWeekEnd ? 'mr-2 sm:mr-3' : ''}`}
                    title={`${dateKey}: ${stats?.completed || 0}/${stats?.total || 0} complete`}
                  >
                    <span className="block text-[9px] font-bold sm:text-[10px]">
                      {WEEKDAY_SHORT[day.getDay()]}
                    </span>
                    <span className="block text-[11px] font-bold leading-3 sm:text-xs">
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}

              {dailyHabits.map((habit) => (
                <div key={habit.id} className="contents">
                  <div className="min-w-0 rounded-lg bg-surface-50 px-2 py-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm">{habit.icon}</span>
                      <span className="truncate text-xs font-semibold text-gray-700 sm:text-sm">
                        {habit.name}
                      </span>
                    </div>
                    {habit.category && (
                      <span className="block truncate text-[9px] text-gray-400">{habit.category}</span>
                    )}
                  </div>

                  {days.map((day) => {
                    const dateKey = toDateKey(day);
                    const cellKey = `${habit.id}-${dateKey}`;
                    const completed = completedKeys.has(cellKey);
                    const isToday = dateKey === todayKey;
                    const isWeekEnd = day.getDay() === 0 && dateKey !== endDate;
                    const saving = savingKey === cellKey;
                    return (
                      <button
                        key={cellKey}
                        onClick={() => handleToggle(habit.id, dateKey)}
                        disabled={saving}
                        className={`aspect-square min-h-4 rounded-[4px] border transition-all sm:min-h-5 lg:min-h-6 ${
                          completed
                            ? 'border-green-400 bg-green-400 hover:bg-green-500'
                            : 'border-surface-200 bg-surface-100 hover:bg-green-100 hover:border-green-200'
                        } ${isToday ? 'ring-1 ring-brand-400 ring-offset-1' : ''} ${
                          isWeekEnd ? 'mr-2 sm:mr-3' : ''
                        } ${saving ? 'opacity-50' : ''}`}
                        title={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                        aria-label={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
