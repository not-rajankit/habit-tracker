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
        <div className="overflow-x-auto bg-white rounded-2xl border border-surface-200/70 shadow-sm">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-white min-w-[150px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-surface-200">
                  Habit
                </th>
                {days.map((day) => {
                  const dateKey = toDateKey(day);
                  const isToday = dateKey === todayKey;
                  return (
                    <th
                      key={dateKey}
                      className={`min-w-[54px] px-2 py-3 text-center border-b border-l border-surface-100 ${
                        isToday ? 'bg-brand-50' : 'bg-white'
                      }`}
                    >
                      <span className={`block text-[10px] font-semibold ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>
                        {WEEKDAY_SHORT[day.getDay()]}
                      </span>
                      <span className={`block text-sm font-bold mt-0.5 ${isToday ? 'text-brand-700' : 'text-gray-700'}`}>
                        {day.getDate()}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {dailyHabits.map((habit) => (
                <tr key={habit.id} className="group">
                  <th className="sticky left-0 z-10 bg-white min-w-[150px] px-3 py-3 text-left border-b border-surface-100 group-last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{habit.icon}</span>
                      <span className="text-sm font-semibold text-gray-700 truncate">{habit.name}</span>
                    </div>
                    {habit.category && (
                      <span className="block text-[10px] text-gray-400 mt-0.5 truncate">{habit.category}</span>
                    )}
                  </th>
                  {days.map((day) => {
                    const dateKey = toDateKey(day);
                    const cellKey = `${habit.id}-${dateKey}`;
                    const completed = completedKeys.has(cellKey);
                    const isToday = dateKey === todayKey;
                    const saving = savingKey === cellKey;
                    return (
                      <td
                        key={cellKey}
                        className={`px-2 py-2 text-center border-b border-l border-surface-100 group-last:border-b-0 ${
                          isToday ? 'bg-brand-50/70' : ''
                        }`}
                      >
                        <button
                          onClick={() => handleToggle(habit.id, dateKey)}
                          disabled={saving}
                          className={`w-9 h-9 rounded-xl inline-flex items-center justify-center text-sm font-bold border ${
                            completed
                              ? 'bg-accent-green text-white border-accent-green shadow-sm'
                              : 'bg-surface-100 text-transparent border-surface-200 hover:bg-surface-200'
                          } ${saving ? 'opacity-50' : ''}`}
                          title={`${habit.name} on ${dateKey}`}
                        >
                          {completed ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
