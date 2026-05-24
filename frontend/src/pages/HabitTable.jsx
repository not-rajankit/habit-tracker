import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEntries, getHabits, toggleEntry } from '../api';

const WEEKDAY_NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOT_COLORS = [
  'bg-rose-500',
  'bg-pink-400',
  'bg-orange-400',
  'bg-violet-500',
  'bg-purple-400',
  'bg-sky-400',
  'bg-emerald-400',
  'bg-amber-400',
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

  const habitTotals = useMemo(() => {
    const totals = {};
    dailyHabits.forEach((habit) => {
      totals[habit.id] = days.filter((day) =>
        completedKeys.has(`${habit.id}-${toDateKey(day)}`)
      ).length;
    });
    return totals;
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Habit Table</h1>
          <p className="mt-1 text-xs text-gray-400">{title}</p>
        </div>
        <div className="flex shrink-0 rounded-xl bg-surface-100 p-1">
          {['week', 'month'].map((option) => (
            <button
              key={option}
              onClick={() => handleModeChange(option)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                mode === option ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => setPeriodOffset((offset) => offset - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 text-gray-500 hover:bg-surface-200"
        >
          ←
        </button>
        <button
          onClick={() => setPeriodOffset(0)}
          className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm"
        >
          Current {mode}
        </button>
        <button
          onClick={() => setPeriodOffset((offset) => offset + 1)}
          disabled={periodOffset >= 0}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 text-gray-500 hover:bg-surface-200 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {dailyHabits.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-5xl">▦</div>
          <h3 className="text-lg font-semibold text-gray-700">No daily habits</h3>
          <p className="mt-1 text-sm text-gray-400">Daily habits will appear as rows here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto sm:overflow-visible">
          <div className={`rounded-2xl border border-surface-200/70 bg-white p-3 shadow-sm sm:min-w-0 sm:p-4 ${
            mode === 'month' ? 'min-w-[780px]' : 'min-w-[520px]'
          }`}>
            <div
              className="grid items-stretch gap-[3px] sm:gap-1"
              style={{
                gridTemplateColumns: mode === 'month'
                  ? `minmax(116px, 4fr) repeat(${days.length}, minmax(0, 1fr)) minmax(42px, 1.2fr)`
                  : `minmax(132px, 3fr) repeat(${days.length}, minmax(28px, 1fr)) minmax(42px, 1fr)`,
              }}
            >
              <div className="flex min-h-12 items-center justify-center rounded border border-gray-300 bg-surface-50 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:min-h-14">
                Day
              </div>

              {days.map((day) => {
                const dateKey = toDateKey(day);
                const isToday = dateKey === todayKey;
                const weekGap = day.getDay() === 0 && dateKey !== endDate ? 'mr-1 sm:mr-1.5' : '';
                return (
                  <div
                    key={dateKey}
                    className={`flex aspect-square min-h-5 flex-col items-center justify-center rounded border border-gray-300 bg-white text-[9px] font-bold leading-none text-gray-700 sm:min-h-6 ${
                      isToday ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300' : ''
                    } ${weekGap}`}
                    title={dateKey}
                  >
                    <span>{day.getDate()}</span>
                    <span className="mt-0.5 text-[8px] font-semibold text-gray-400">
                      {WEEKDAY_NARROW[day.getDay()]}
                    </span>
                  </div>
                );
              })}

              <div className="flex min-h-12 items-center justify-center rounded border border-gray-300 bg-surface-50 px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:min-h-14">
                Result
              </div>

              <div className="flex min-h-8 items-center rounded border border-gray-300 bg-surface-50 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:min-h-9">
                Habit
              </div>

              {days.map((day) => {
                const dateKey = toDateKey(day);
                const weekGap = day.getDay() === 0 && dateKey !== endDate ? 'mr-1 sm:mr-1.5' : '';
                return (
                  <div
                    key={`${dateKey}-blank`}
                    className={`aspect-square min-h-5 rounded border border-gray-200 bg-surface-50 sm:min-h-6 ${weekGap}`}
                    aria-hidden="true"
                  />
                );
              })}

              <div className="min-h-8 rounded border border-gray-300 bg-surface-50 sm:min-h-9" aria-hidden="true" />

              {dailyHabits.map((habit, habitIndex) => (
                <div key={habit.id} className="contents">
                  <div className="flex min-h-8 min-w-0 items-center rounded border border-gray-300 bg-white px-2 sm:min-h-9">
                    <span className="mr-1.5 text-sm">{habit.icon}</span>
                    <span className="truncate text-[11px] font-semibold text-gray-700 sm:text-xs">
                      {habit.name}
                    </span>
                  </div>

                  {days.map((day) => {
                    const dateKey = toDateKey(day);
                    const cellKey = `${habit.id}-${dateKey}`;
                    const completed = completedKeys.has(cellKey);
                    const isToday = dateKey === todayKey;
                    const weekGap = day.getDay() === 0 && dateKey !== endDate ? 'mr-1 sm:mr-1.5' : '';
                    const saving = savingKey === cellKey;
                    return (
                      <button
                        key={cellKey}
                        onClick={() => handleToggle(habit.id, dateKey)}
                        disabled={saving}
                        className={`relative aspect-square min-h-5 rounded border border-gray-300 bg-white transition-colors hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 sm:min-h-6 ${
                          isToday ? 'border-brand-400 bg-brand-50/60' : ''
                        } ${weekGap} ${saving ? 'opacity-50' : ''}`}
                        title={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                        aria-label={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                      >
                        {completed && (
                          <span
                            className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-2.5 sm:w-2.5 ${DOT_COLORS[habitIndex % DOT_COLORS.length]}`}
                          />
                        )}
                      </button>
                    );
                  })}

                  <div className="flex min-h-8 items-center justify-center rounded border border-gray-300 bg-white text-xs font-bold text-gray-700 sm:min-h-9">
                    {habitTotals[habit.id] || 0}/{days.length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
