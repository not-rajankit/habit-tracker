import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEntries, getHabits, toggleEntry } from '../api';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
          <div className={`rounded-2xl border border-surface-200/70 bg-[#fffdf7] p-4 shadow-sm sm:min-w-0 sm:p-6 ${
            mode === 'month' ? 'min-w-[860px]' : 'min-w-[540px]'
          }`}>
            <div className="mb-4 flex items-end justify-between gap-4 border-b-2 border-gray-800 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Habit Tracker</p>
                <h2 className="text-2xl font-black text-gray-900 sm:text-3xl">{title}</h2>
              </div>
              <p className="hidden text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 sm:block">
                one day at a time
              </p>
            </div>
            <div
              className="grid items-stretch gap-0"
              style={{
                gridTemplateColumns: mode === 'month'
                  ? `minmax(128px, 2.4fr) repeat(${days.length}, minmax(0, 1fr))`
                  : `minmax(150px, 2.2fr) repeat(${days.length}, minmax(28px, 1fr))`,
              }}
            >
              <div className="row-span-2 flex items-center border-2 border-gray-800 bg-[#fffaf0] px-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">
                Habit
              </div>

              {days.map((day) => {
                const dateKey = toDateKey(day);
                const isToday = dateKey === todayKey;
                const weekGap = day.getDay() === 0 && dateKey !== endDate ? 'mr-1.5 sm:mr-2' : '';
                return (
                  <div
                    key={`${dateKey}-weekday`}
                    className={`flex h-6 items-center justify-center border-y-2 border-r-2 border-gray-800 bg-[#fffaf0] text-[10px] font-black text-gray-800 ${weekGap} ${
                      isToday ? 'bg-brand-50 text-brand-700' : ''
                    }`}
                    title={dateKey}
                  >
                    <span className="sm:hidden">{WEEKDAY_NARROW[day.getDay()]}</span>
                    <span className="hidden sm:inline">{WEEKDAY_SHORT[day.getDay()].slice(0, 1)}</span>
                  </div>
                );
              })}

              {days.map((day) => {
                const dateKey = toDateKey(day);
                const isToday = dateKey === todayKey;
                const weekGap = day.getDay() === 0 && dateKey !== endDate ? 'mr-1.5 sm:mr-2' : '';
                return (
                  <div
                    key={`${dateKey}-date`}
                    className={`flex h-6 items-center justify-center border-b-2 border-r-2 border-gray-800 bg-[#fffaf0] text-[10px] font-black text-gray-800 ${weekGap} ${
                      isToday ? 'bg-brand-50 text-brand-700' : ''
                    }`}
                    title={dateKey}
                  >
                    {day.getDate()}
                  </div>
                );
              })}

              {dailyHabits.map((habit, habitIndex) => (
                <div key={habit.id} className="contents">
                  <div className="min-w-0 border-x-2 border-b-2 border-gray-800 bg-[#fffdf7] px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm">{habit.icon}</span>
                      <span className="truncate text-xs font-bold text-gray-800 sm:text-[13px]">
                        {habit.name}
                      </span>
                    </div>
                    {habit.category && (
                      <span className="block truncate text-[9px] font-medium text-gray-400">{habit.category}</span>
                    )}
                  </div>

                  {days.map((day) => {
                    const dateKey = toDateKey(day);
                    const cellKey = `${habit.id}-${dateKey}`;
                    const completed = completedKeys.has(cellKey);
                    const isToday = dateKey === todayKey;
                    const weekGap = day.getDay() === 0 && dateKey !== endDate ? 'mr-1.5 sm:mr-2' : '';
                    const saving = savingKey === cellKey;
                    return (
                      <button
                        key={cellKey}
                        onClick={() => handleToggle(habit.id, dateKey)}
                        disabled={saving}
                        className={`relative aspect-square min-h-5 border-b-2 border-r-2 border-gray-800 bg-[#fffdf7] transition-all hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                          isToday ? 'bg-brand-50/70' : ''
                        } ${weekGap} ${saving ? 'opacity-50' : ''}`}
                        title={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                        aria-label={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                      >
                        {completed && (
                          <span
                            className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm sm:h-3 sm:w-3 ${DOT_COLORS[habitIndex % DOT_COLORS.length]}`}
                          />
                        )}
                      </button>
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
