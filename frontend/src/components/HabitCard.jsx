import { toggleEntry } from '../api';

export default function HabitCard({ habit, onToggle }) {
  const handleToggle = async () => {
    try {
      await toggleEntry(habit.id);
      onToggle();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-surface-200/60 hover:shadow-md transition-all animate-fade-in">
      {/* Check button */}
      <button
        onClick={handleToggle}
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all active:scale-90 ${
          habit.completed_today
            ? 'bg-accent-green text-white shadow-md shadow-green-200 animate-check'
            : 'bg-surface-100 text-gray-300 hover:bg-surface-200 hover:text-gray-400'
        }`}
      >
        {habit.completed_today ? '✓' : ''}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{habit.icon}</span>
          <span className={`font-medium text-[15px] truncate ${habit.completed_today ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {habit.name}
          </span>
        </div>
        {habit.category && (
          <span className="text-[11px] text-gray-400 mt-0.5 block">{habit.category}</span>
        )}
      </div>

      {/* Streak */}
      <div className="text-right shrink-0">
        {habit.current_streak > 0 ? (
          <div className="flex items-center gap-1">
            <span className="text-sm">🔥</span>
            <span className="text-sm font-semibold text-orange-500">{habit.current_streak}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
        {habit.best_streak > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            Best: {habit.best_streak}
          </div>
        )}
      </div>
    </div>
  );
}
