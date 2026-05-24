import { useState, useEffect } from 'react';
import { getWeeklySummary } from '../api';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayTooltip({ day }) {
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
      <p className="mt-1 text-[11px] text-gray-400">
        {day.completed}/{day.total} habits completed
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

export default function WeeklySummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const d = new Date();
        d.setDate(d.getDate() + weekOffset * 7);
        const result = await getWeeklySummary(d.toISOString().split('T')[0]);
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [weekOffset]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="pt-6 text-center text-gray-400">No data available</div>;

  const maxDayCount = Math.max(...(data.daily_breakdown?.map(d => d.total) || [1]), 1);

  return (
    <div className="pt-6">
      {/* Header with nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setWeekOffset(w => w - 1)} className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-gray-400 hover:bg-surface-200 hover:text-gray-600 transition-all">
          ←
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">Weekly Summary</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {data.start_date} — {data.end_date}
          </p>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}
          className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-gray-400 hover:bg-surface-200 hover:text-gray-600 transition-all disabled:opacity-30">
          →
        </button>
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-5 mb-6 text-white shadow-xl shadow-purple-200/50 lg:p-6">
        <p className="text-purple-200 text-sm font-medium">This Week</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-4xl font-bold">{data.completion_percentage}%</span>
          <span className="text-purple-200 text-sm">consistency</span>
        </div>
        <p className="text-purple-100 text-sm mt-2">
          {data.total_completed}/{data.total_possible} habits completed
        </p>
      </div>

      {/* Daily bars */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-200/60 mb-4 lg:p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Breakdown</h3>
        <div className="flex items-end justify-between gap-2 h-36 sm:h-44 lg:h-56">
          {data.daily_breakdown?.map((day, i) => {
            const height = maxDayCount > 0 ? (day.completed / maxDayCount) * 100 : 0;
            const isToday = day.date === new Date().toISOString().split('T')[0];
            return (
              <div key={i} className="group relative flex-1 flex flex-col items-center gap-1.5" tabIndex={0}>
                <DayTooltip day={day} />
                <span className="text-[10px] text-gray-400 font-medium">{day.completed}</span>
                <div className="w-full bg-surface-100 rounded-lg relative min-h-24 lg:min-h-40">
                  <div
                    className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 ${isToday ? 'bg-brand-500' : 'bg-brand-300'}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>
                  {DAY_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Best & Weakest */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.best_habit && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-surface-200/60">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Best Habit</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span>{data.best_habit.icon}</span>
              <span className="text-sm font-semibold text-gray-700 truncate">{data.best_habit.name}</span>
            </div>
            <p className="text-xs text-accent-green font-medium mt-1">{data.best_habit.count} times</p>
          </div>
        )}
        {data.weakest_habit && data.weakest_habit.name !== data.best_habit?.name && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-surface-200/60">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Needs Work</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span>{data.weakest_habit.icon}</span>
              <span className="text-sm font-semibold text-gray-700 truncate">{data.weakest_habit.name}</span>
            </div>
            <p className="text-xs text-accent-orange font-medium mt-1">{data.weakest_habit.count} times</p>
          </div>
        )}
      </div>
    </div>
  );
}
