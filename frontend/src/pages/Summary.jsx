import { useEffect, useState } from 'react';
import { getMonthlySummary, getWeeklySummary } from '../api';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return '';
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return '';
  return new Date(year, month - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

function formatFocusDuration(totalSeconds = 0) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '0m';
}

function WeekDayTooltip({ day }) {
  const completedPreview = day.completed_habits?.slice(0, 3) || [];
  const missedPreview = day.missed_habits?.slice(0, 3) || [];

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 hidden w-64 -translate-x-1/2 rounded-xl border border-surface-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus-within:block">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-800">{day.date}</p>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">
          {day.completion_percentage}%
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">{day.completed}/{day.total} habits completed</p>
      <p className="mt-1 text-[11px] font-semibold text-brand-600">
        Focus {formatFocusDuration(day.focus_seconds)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-accent-green">Done</p>
          <div className="mt-1 space-y-1">
            {completedPreview.length > 0 ? completedPreview.map((habit) => (
              <p key={habit.id} className="truncate text-[11px] text-gray-600">{habit.icon} {habit.name}</p>
            )) : <p className="text-[11px] text-gray-300">None</p>}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-accent-orange">Left</p>
          <div className="mt-1 space-y-1">
            {missedPreview.length > 0 ? missedPreview.map((habit) => (
              <p key={habit.id} className="truncate text-[11px] text-gray-600">{habit.icon} {habit.name}</p>
            )) : <p className="text-[11px] text-gray-300">All done</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthDayTooltip({ details }) {
  if (!details) return null;
  const completedPreview = details.completed_habits?.slice(0, 4) || [];
  const missedPreview = details.missed_habits?.slice(0, 4) || [];

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-xl border border-surface-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus-within:block">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-800">{details.date}</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
          {details.completion_percentage}%
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">{details.completed}/{details.total} habits completed</p>
      <p className="mt-1 text-[11px] font-semibold text-brand-600">
        Focus {formatFocusDuration(details.focus_seconds)}
      </p>
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase text-accent-green">Completed</p>
          <p className="mt-1 text-[11px] text-gray-600">
            {completedPreview.length > 0
              ? completedPreview.map((habit) => `${habit.icon} ${habit.name}`).join(', ')
              : 'No habits completed'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-accent-orange">Remaining</p>
          <p className="mt-1 text-[11px] text-gray-600">
            {missedPreview.length > 0
              ? missedPreview.map((habit) => `${habit.icon} ${habit.name}`).join(', ')
              : 'All habits complete'}
          </p>
        </div>
      </div>
    </div>
  );
}

function WeeklyPanel({ data }) {
  const breakdown = data.daily_breakdown || [];
  const maxDayCount = Math.max(...(data.daily_breakdown?.map((day) => day.total) || [1]), 1);
  const todayKey = toDateKey(new Date());

  return (
    <>
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-5 text-white shadow-xl shadow-purple-200/50 lg:p-6">
        <p className="text-sm font-medium text-purple-200">This Week</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold">{data.completion_percentage}%</span>
          <span className="text-sm text-purple-200">consistency</span>
        </div>
        <p className="mt-2 text-sm text-purple-100">{data.total_completed}/{data.total_possible} habits completed</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {formatFocusDuration(data.total_focus_seconds)} focus
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-surface-200/60 bg-white p-5 shadow-sm lg:p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Daily Breakdown</h3>
        <div className="flex h-36 items-end justify-between gap-2 sm:h-44 lg:h-56">
          {breakdown.map((day, index) => {
            const height = maxDayCount > 0 ? (day.completed / maxDayCount) * 100 : 0;
            const isToday = day.date === todayKey;
            return (
              <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-1.5" tabIndex={0}>
                <WeekDayTooltip day={day} />
                <span className="text-[10px] font-medium text-gray-400">{day.completed}</span>
                <div className="relative min-h-24 w-full rounded-lg bg-surface-100 lg:min-h-40">
                  <div
                    className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 ${isToday ? 'bg-brand-500' : 'bg-brand-300'}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>
                  {DAY_LABELS[index]}
                </span>
                {day.focus_seconds > 0 && (
                  <span className="text-[10px] font-bold text-brand-500">
                    {formatFocusDuration(day.focus_seconds)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.best_habit && (
          <div className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Best Habit</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span>{data.best_habit.icon}</span>
              <span className="truncate text-sm font-semibold text-gray-700">{data.best_habit.name}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-accent-green">{data.best_habit.count} times</p>
          </div>
        )}
        {data.weakest_habit && data.weakest_habit.name !== data.best_habit?.name && (
          <div className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Needs Work</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span>{data.weakest_habit.icon}</span>
              <span className="truncate text-sm font-semibold text-gray-700">{data.weakest_habit.name}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-accent-orange">{data.weakest_habit.count} times</p>
          </div>
        )}
      </div>
    </>
  );
}

function MonthlyPanel({ data }) {
  if (!data.month) return <div className="pt-6 text-center text-gray-400">Monthly data is unavailable.</div>;

  const [year, month] = data.month.split('-').map(Number);
  if (!year || !month) return <div className="pt-6 text-center text-gray-400">Monthly data is unavailable.</div>;

  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const totalHabitsCount = data.total_possible / data.days_in_month || 1;
  const todayKey = toDateKey(new Date());

  const calendarDays = [];
  for (let index = 0; index < startOffset; index++) calendarDays.push(null);
  for (let day = 1; day <= data.days_in_month; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, count: data.calendar?.[dateStr] || 0, dateStr });
  }

  const getHeatColor = (count) => {
    if (count === 0) return 'bg-surface-100';
    const ratio = count / totalHabitsCount;
    if (ratio >= 0.8) return 'bg-green-400';
    if (ratio >= 0.5) return 'bg-green-300';
    if (ratio >= 0.2) return 'bg-green-200';
    return 'bg-green-100';
  };

  return (
    <>
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-200/50 lg:p-6">
        <p className="text-sm font-medium text-emerald-100">Monthly Overview</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold">{data.completion_percentage}%</span>
          <span className="text-sm text-emerald-200">overall</span>
        </div>
        <div className="mt-3 flex gap-6 text-sm text-emerald-100">
          <div><span className="font-semibold text-white">{data.successful_days}</span> active days</div>
          <div><span className="font-semibold text-white">{data.total_completed}</span> completions</div>
          <div><span className="font-semibold text-white">{formatFocusDuration(data.total_focus_seconds)}</span> focus</div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-surface-200/60 bg-white p-5 shadow-sm lg:p-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Activity Calendar</h3>
        <div className="mb-2 grid grid-cols-7 gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <div key={index} className="py-1 text-center text-[10px] font-medium text-gray-400">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (!day) return <div key={index} />;
            const isToday = day.dateStr === todayKey;
            return (
              <div
                key={day.dateStr}
                tabIndex={0}
                className={`group relative flex aspect-square items-center justify-center rounded-lg text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-300 ${getHeatColor(day.count)} ${isToday ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
                title={`${day.dateStr}: ${day.count} habits`}
              >
                <MonthDayTooltip details={data.daily_details?.[day.dateStr]} />
                {day.day}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-gray-400">Less</span>
          {['bg-surface-100', 'bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400'].map((color) => (
            <div key={color} className={`h-3 w-3 rounded ${color}`} />
          ))}
          <span className="text-[10px] text-gray-400">More</span>
        </div>
      </div>

      {data.most_consistent_habit && (
        <div className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Most Consistent</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{data.most_consistent_habit.icon}</span>
            <span className="font-semibold text-gray-700">{data.most_consistent_habit.name}</span>
            <span className="ml-auto text-sm font-semibold text-accent-green">{data.most_consistent_habit.count} days</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function Summary({ initialView = 'week' }) {
  const [view, setView] = useState(initialView);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState({ view: initialView, data: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setView(initialView);
    setOffset(0);
  }, [initialView]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const date = new Date();
        let result;

        if (view === 'week') {
          date.setDate(date.getDate() + offset * 7);
          result = await getWeeklySummary(toDateKey(date));
        } else {
          date.setMonth(date.getMonth() + offset);
          result = await getMonthlySummary(toDateKey(date));
        }

        if (!cancelled) setSummary({ view, data: result });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setSummary({ view, data: null });
          setError('Unable to load summary.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [offset, view]);

  const data = summary.view === view ? summary.data : null;
  const label = view === 'week'
    ? data ? `${data.start_date} to ${data.end_date}` : ''
    : data ? formatMonthLabel(data.month) : '';

  return (
    <div className="pt-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={() => setOffset((value) => value - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 text-gray-400 transition-all hover:bg-surface-200 hover:text-gray-600"
        >
          ←
        </button>
        <div className="min-w-0 text-center">
          <h1 className="text-xl font-bold text-gray-800">Summary</h1>
          <p className="mt-0.5 truncate text-xs text-gray-400">{label}</p>
        </div>
        <button
          onClick={() => setOffset((value) => value + 1)}
          disabled={offset >= 0}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 text-gray-400 transition-all hover:bg-surface-200 hover:text-gray-600 disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="mb-5 flex justify-center">
        <div className="flex rounded-xl bg-surface-100 p-1">
          {['week', 'month'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setView(option);
                setOffset(0);
              }}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize ${
                view === option ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-8 text-center text-sm font-semibold text-red-500">
          {error}
        </div>
      ) : !data ? (
        <div className="pt-6 text-center text-gray-400">No data available</div>
      ) : view === 'week' ? (
        <WeeklyPanel data={data} />
      ) : (
        <MonthlyPanel data={data} />
      )}
    </div>
  );
}
