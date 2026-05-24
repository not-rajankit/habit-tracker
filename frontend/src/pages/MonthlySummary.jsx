import { useState, useEffect } from 'react';
import { getMonthlySummary } from '../api';

function DayTooltip({ details }) {
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
      <p className="mt-1 text-[11px] text-gray-400">
        {details.completed}/{details.total} habits completed
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

export default function MonthlySummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const d = new Date();
        d.setMonth(d.getMonth() + monthOffset);
        const result = await getMonthlySummary(d.toISOString().split('T')[0]);
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [monthOffset]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="pt-6 text-center text-gray-400">No data available</div>;

  // Calendar grid
  const [year, month] = data.month.split('-').map(Number);
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Mon=0
  const totalHabitsCount = data.total_possible / data.days_in_month || 1;

  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let d = 1; d <= data.days_in_month; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, count: data.calendar?.[dateStr] || 0 });
  }

  const getHeatColor = (count) => {
    if (count === 0) return 'bg-surface-100';
    const ratio = count / totalHabitsCount;
    if (ratio >= 0.8) return 'bg-green-400';
    if (ratio >= 0.5) return 'bg-green-300';
    if (ratio >= 0.2) return 'bg-green-200';
    return 'bg-green-100';
  };

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setMonthOffset(m => m - 1)} className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-gray-400 hover:bg-surface-200 hover:text-gray-600 transition-all">
          ←
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">Monthly Summary</h1>
          <p className="text-xs text-gray-400 mt-0.5">{monthName}</p>
        </div>
        <button onClick={() => setMonthOffset(m => m + 1)} disabled={monthOffset >= 0}
          className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-gray-400 hover:bg-surface-200 hover:text-gray-600 transition-all disabled:opacity-30">
          →
        </button>
      </div>

      {/* Stats cards */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 mb-6 text-white shadow-xl shadow-emerald-200/50 lg:p-6">
        <p className="text-emerald-100 text-sm font-medium">Monthly Overview</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-4xl font-bold">{data.completion_percentage}%</span>
          <span className="text-emerald-200 text-sm">overall</span>
        </div>
        <div className="flex gap-6 mt-3 text-sm text-emerald-100">
          <div>
            <span className="font-semibold text-white">{data.successful_days}</span> active days
          </div>
          <div>
            <span className="font-semibold text-white">{data.total_completed}</span> completions
          </div>
        </div>
      </div>

      {/* Calendar heatmap */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-200/60 mb-4 lg:p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Calendar</h3>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={i} />;
            const todayStr = new Date().toISOString().split('T')[0];
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const details = data.daily_details?.[dateStr];
            return (
              <div
                key={i}
                tabIndex={0}
                className={`group relative aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-300 ${getHeatColor(day.count)} ${isToday ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
                title={`${dateStr}: ${day.count} habits`}
              >
                <DayTooltip details={details} />
                {day.day}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-3">
          <span className="text-[10px] text-gray-400">Less</span>
          {['bg-surface-100', 'bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400'].map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded ${c}`} />
          ))}
          <span className="text-[10px] text-gray-400">More</span>
        </div>
      </div>

      {/* Most consistent */}
      {data.most_consistent_habit && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-surface-200/60">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Most Consistent</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg">{data.most_consistent_habit.icon}</span>
            <span className="font-semibold text-gray-700">{data.most_consistent_habit.name}</span>
            <span className="ml-auto text-sm text-accent-green font-semibold">{data.most_consistent_habit.count} days</span>
          </div>
        </div>
      )}
    </div>
  );
}
