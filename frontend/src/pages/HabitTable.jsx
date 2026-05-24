import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createHabit, getEntries, getHabits, toggleEntry, updateHabit, updateHabitOrder } from '../api';

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeEntryDate(date) {
  if (!date) return '';
  if (date instanceof Date) return toDateKey(date);
  const value = String(date);
  if (!value.includes('T')) return value.slice(0, 10);
  return toDateKey(new Date(value));
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

function isWeekBreak(day, endDate) {
  return day.getDay() === 0 && toDateKey(day) !== endDate;
}

export default function HabitTable() {
  const tableScrollRef = useRef(null);
  const autoScrolledPeriodRef = useRef('');
  const scrollMemoryRef = useRef({});
  const [mode, setMode] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editHabits, setEditHabits] = useState([]);
  const [draggedHabitId, setDraggedHabitId] = useState(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const days = useMemo(
    () => (mode === 'week' ? buildWeekDays(periodOffset) : buildMonthDays(periodOffset)),
    [mode, periodOffset]
  );

  const startDate = toDateKey(days[0]);
  const endDate = toDateKey(days[days.length - 1]);
  const periodKey = `${mode}:${startDate}:${endDate}`;
  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(addDays(new Date(), -1));

  const dailyHabits = useMemo(
    () => habits.filter((habit) => habit.frequency === 'daily'),
    [habits]
  );

  useEffect(() => {
    if (editMode) setEditHabits(dailyHabits);
  }, [dailyHabits, editMode]);

  const completedKeys = useMemo(() => {
    const keys = new Set();
    entries.forEach((entry) => {
      const date = normalizeEntryDate(entry.date);
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

  const gridTemplateColumns = useMemo(() => {
    const habitColumn = mode === 'month' ? '190px' : 'minmax(150px,3.5fr)';
    const dayColumn = mode === 'month' ? '42px' : 'minmax(28px,1fr)';
    const resultColumn = mode === 'month' ? '96px' : 'minmax(68px,1.2fr)';
    const dayColumns = days
      .flatMap((day) => isWeekBreak(day, endDate) ? [dayColumn, '8px'] : [dayColumn])
      .join(' ');

    return `${habitColumn} ${dayColumns} ${resultColumn}`;
  }, [days, endDate, mode]);

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

  useEffect(() => {
    if (loading || mode !== 'month' || dailyHabits.length === 0) return;

    const frameId = requestAnimationFrame(() => {
      const scroller = tableScrollRef.current;
      if (!scroller) return;

      const savedScrollLeft = scrollMemoryRef.current[periodKey];
      if (typeof savedScrollLeft === 'number') {
        scroller.scrollLeft = savedScrollLeft;
        return;
      }

      if (autoScrolledPeriodRef.current === periodKey) return;

      const visibleToday = days.find((day) => toDateKey(day) === todayKey);
      const weekEnd = addDays(startOfWeek(new Date()), 6);
      const weekEndKey = toDateKey(weekEnd);
      const visibleWeekEnd = days.find((day) => toDateKey(day) === weekEndKey);
      const targetKey = visibleWeekEnd ? weekEndKey : visibleToday ? todayKey : toDateKey(days[days.length - 1]);
      const targetColumn = scroller.querySelector(`[data-date-column="${targetKey}"]`);
      const resultColumn = scroller.querySelector('[data-result-column="true"]');
      const resultWidth = resultColumn?.getBoundingClientRect().width || 96;

      if (targetColumn) {
        const nextScrollLeft = Math.max(
          0,
          targetColumn.offsetLeft - scroller.clientWidth + targetColumn.offsetWidth + resultWidth + 16
        );
        scroller.scrollLeft = nextScrollLeft;
        scrollMemoryRef.current[periodKey] = nextScrollLeft;
      } else {
        scroller.scrollLeft = scroller.scrollWidth;
        scrollMemoryRef.current[periodKey] = scroller.scrollLeft;
      }

      autoScrolledPeriodRef.current = periodKey;
    });

    return () => cancelAnimationFrame(frameId);
  }, [dailyHabits.length, days, loading, mode, periodKey, todayKey]);

  const rememberTableScroll = () => {
    if (mode === 'month' && tableScrollRef.current) {
      scrollMemoryRef.current[periodKey] = tableScrollRef.current.scrollLeft;
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setPeriodOffset(0);
  };

  const handleToggle = async (habitId, date) => {
    const key = `${habitId}-${date}`;
    rememberTableScroll();
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

  const openEditView = () => {
    setEditHabits(dailyHabits);
    setNewHabitName('');
    setEditMode(true);
  };

  const closeEditView = () => {
    setDraggedHabitId(null);
    setNewHabitName('');
    setEditMode(false);
  };

  const handleEditNameChange = (habitId, name) => {
    setEditHabits((current) =>
      current.map((habit) => habit.id === habitId ? { ...habit, name } : habit)
    );
  };

  const saveHabitName = async (habit) => {
    const nextName = habit.name.trim();
    const original = dailyHabits.find((item) => item.id === habit.id);
    if (!nextName || !original || nextName === original.name) return;

    rememberTableScroll();
    setEditSaving(true);
    try {
      await updateHabit(habit.id, { name: nextName });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const reorderEditHabits = async (targetHabitId) => {
    if (!draggedHabitId || draggedHabitId === targetHabitId) return;

    const fromIndex = editHabits.findIndex((habit) => habit.id === draggedHabitId);
    const toIndex = editHabits.findIndex((habit) => habit.id === targetHabitId);
    if (fromIndex === -1 || toIndex === -1) return;

    const nextHabits = [...editHabits];
    const [movedHabit] = nextHabits.splice(fromIndex, 1);
    nextHabits.splice(toIndex, 0, movedHabit);
    setEditHabits(nextHabits);
    setDraggedHabitId(null);

    rememberTableScroll();
    setEditSaving(true);
    try {
      await updateHabitOrder(nextHabits.map((habit) => habit.id));
      await fetchData();
    } catch (err) {
      console.error(err);
      setEditHabits(dailyHabits);
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddHabit = async (event) => {
    event.preventDefault();
    const name = newHabitName.trim();
    if (!name) return;

    rememberTableScroll();
    setEditSaving(true);
    try {
      await createHabit({ name, frequency: 'daily', icon: '✅' });
      setNewHabitName('');
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={editMode ? closeEditView : openEditView}
            className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-sm ${
              editMode
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'border border-surface-200 bg-white text-gray-500 hover:bg-surface-100'
            }`}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
          <div className="flex rounded-xl bg-surface-100 p-1">
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
      </div>

      {editMode && (
        <div className="mb-5 rounded-2xl border border-surface-200/70 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Edit Table Habits</h2>
              <p className="mt-0.5 text-xs text-gray-400">Drag rows to reorder. Rename titles inline.</p>
            </div>
            {editSaving && <span className="text-xs font-semibold text-gray-400">Saving...</span>}
          </div>

          <div className="space-y-2">
            {editHabits.map((habit) => (
              <div
                key={habit.id}
                draggable
                onDragStart={() => setDraggedHabitId(habit.id)}
                onDragEnd={() => setDraggedHabitId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderEditHabits(habit.id)}
                className={`flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 ${
                  draggedHabitId === habit.id ? 'opacity-50' : ''
                }`}
              >
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg bg-white text-gray-400 active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  ☰
                </button>
                <span className="shrink-0 text-base">{habit.icon}</span>
                <input
                  value={habit.name}
                  onChange={(event) => handleEditNameChange(habit.id, event.target.value)}
                  onBlur={() => saveHabitName(habit)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            ))}
          </div>

          <form onSubmit={handleAddHabit} className="mt-3 flex gap-2">
            <input
              value={newHabitName}
              onChange={(event) => setNewHabitName(event.target.value)}
              placeholder="New daily habit"
              className="min-w-0 flex-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-300 focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="submit"
              disabled={!newHabitName.trim() || editSaving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      )}

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
          title={`Go to current ${mode}`}
        >
          {title}
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
        <div className="rounded-2xl border border-surface-200/70 bg-[#fffdf7] p-3 shadow-sm sm:p-4">
          <div className="rounded-xl bg-[#ece7dd] p-[3px] sm:p-1">
            <div
              ref={tableScrollRef}
              onScroll={rememberTableScroll}
              className="scrollbar-none overflow-x-auto rounded-lg"
            >
              <div className={mode === 'month' ? 'w-max' : 'min-w-[520px] w-full'}>
            <div
              className="isolate grid items-stretch gap-[3px] sm:gap-1"
              style={{ gridTemplateColumns }}
            >
              <div className="sticky left-0 z-40 flex min-h-11 items-center justify-center rounded-md border border-[#cfc8bc] bg-[#fffaf0] px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:min-h-12">
                Day
              </div>

              {days.map((day) => {
                const dateKey = toDateKey(day);
                const isToday = dateKey === todayKey;
                return (
                  <Fragment key={dateKey}>
                    <div
                      data-date-column={dateKey}
                      className={`relative z-0 flex min-h-5 min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-[#cfc8bc] bg-[#fffdf7] text-[8px] font-bold leading-none text-gray-700 sm:min-h-6 ${
                        isToday ? 'border-brand-500 bg-brand-50 text-brand-700' : ''
                      }`}
                      title={dateKey}
                    >
                      <span className="max-w-full truncate">{day.getDate()}</span>
                      <span className="mt-0.5 max-w-full truncate text-[7px] font-semibold text-gray-400">
                        {WEEKDAY_NARROW[day.getDay()]}
                      </span>
                    </div>
                    {isWeekBreak(day, endDate) && (
                      <div key={`${dateKey}-week-gap`} className="rounded-sm bg-[#ece7dd]" aria-hidden="true" />
                    )}
                  </Fragment>
                );
              })}

              <div data-result-column="true" className="sticky right-0 z-40 flex min-h-11 items-center justify-center rounded-md border border-[#cfc8bc] bg-[#fffaf0] px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:min-h-12">
                Result
              </div>

              {dailyHabits.map((habit, habitIndex) => (
                <div key={habit.id} className="contents">
                  <div className="sticky left-0 z-30 flex min-h-8 min-w-0 items-center rounded-md border border-[#cfc8bc] bg-[#fffdf7] px-2 sm:min-h-9">
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
                    const canToggle = dateKey === todayKey || dateKey === yesterdayKey;
                    const saving = savingKey === cellKey;
                    return (
                      <Fragment key={cellKey}>
                        <button
                          onClick={() => handleToggle(habit.id, dateKey)}
                          disabled={saving || !canToggle}
                          className={`relative z-0 min-h-5 min-w-0 overflow-hidden rounded-md border border-[#cfc8bc] bg-[#fffdf7] transition-colors hover:bg-brand-50 focus:bg-brand-100 focus:outline-none sm:min-h-6 ${
                            isToday ? 'border-brand-400 bg-brand-50/60' : ''
                          } ${canToggle ? '' : 'cursor-not-allowed bg-[#f7f4ee] opacity-60 hover:bg-[#f7f4ee]'} ${
                            saving ? 'opacity-50' : ''
                          }`}
                          title={`${habit.name} on ${dateKey}: ${
                            canToggle
                              ? completed ? 'complete' : 'not complete'
                              : 'only today and yesterday can be changed'
                          }`}
                          aria-label={`${habit.name} on ${dateKey}: ${completed ? 'complete' : 'not complete'}`}
                        >
                          {completed && (
                            <span
                              className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-2.5 sm:w-2.5 ${DOT_COLORS[habitIndex % DOT_COLORS.length]}`}
                            />
                          )}
                        </button>
                        {isWeekBreak(day, endDate) && (
                          <div key={`${cellKey}-week-gap`} className="rounded-sm bg-[#ece7dd]" aria-hidden="true" />
                        )}
                      </Fragment>
                    );
                  })}

                  <div className="sticky right-0 z-30 flex min-h-8 min-w-0 items-center justify-center overflow-hidden rounded-md border border-[#cfc8bc] bg-[#fffdf7] px-1 text-[11px] font-bold text-gray-700 sm:min-h-9 sm:text-xs">
                    {habitTotals[habit.id] || 0}/{days.length}
                  </div>
                </div>
              ))}
            </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
