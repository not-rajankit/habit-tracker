import { useState, useEffect, useCallback } from 'react';
import { getHabits, deleteHabit } from '../api';
import HabitCard from '../components/HabitCard';
import HabitModal from '../components/HabitModal';
import ProgressRing from '../components/ProgressRing';

export default function Home() {
  const [habits, setHabits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editHabit, setEditHabit] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHabits = useCallback(async () => {
    try {
      const data = await getHabits();
      setHabits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const completedCount = habits.filter(h => h.completed_today).length;
  const totalCount = habits.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.current_streak)) : 0;
  const sortedHabits = [...habits].sort((a, b) => {
    if (a.completed_today === b.completed_today) return 0;
    return a.completed_today ? 1 : -1;
  });

  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleEdit = (habit) => {
    setEditHabit(habit);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Archive this habit?')) return;
    try {
      await deleteHabit(id);
      fetchHabits();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 font-medium">
          {dayNames[today.getDay()]}, {monthNames[today.getMonth()]} {today.getDate()}
        </p>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">Today's Habits</h1>
      </div>

      {/* Progress summary card */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 mb-6 text-white shadow-xl shadow-brand-200/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-brand-100 text-sm font-medium">Daily Progress</p>
            <p className="text-3xl font-bold mt-1">
              {completedCount}/{totalCount}
            </p>
            <p className="text-brand-200 text-sm mt-1">habits completed</p>
            {maxStreak > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full">
                <span>🔥</span>
                <span className="text-sm font-semibold">{maxStreak} day streak</span>
              </div>
            )}
          </div>
          <ProgressRing progress={progress} size={90} strokeWidth={7} color="#ffffff" />
        </div>
      </div>

      {/* Habit list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🌱</div>
          <h3 className="text-lg font-semibold text-gray-700">No habits yet</h3>
          <p className="text-sm text-gray-400 mt-1">Tap the button below to create your first habit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedHabits.map((habit, i) => (
            <div key={habit.id} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="group relative">
                <HabitCard habit={habit} onToggle={fetchHabits} />
                {/* Actions on long press / hover */}
                <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                  <button
                    onClick={() => handleEdit(habit)}
                    className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center text-xs text-gray-400 hover:bg-surface-200 hover:text-gray-600"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(habit.id)}
                    className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center text-xs text-gray-400 hover:bg-red-50 hover:text-red-400"
                    title="Archive"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditHabit(null); setShowModal(true); }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-2xl bg-brand-600 text-white text-2xl shadow-xl shadow-brand-300/50 flex items-center justify-center hover:bg-brand-700 active:scale-90 transition-all z-40"
      >
        +
      </button>

      {/* Modal */}
      {showModal && (
        <HabitModal
          habit={editHabit}
          onClose={() => { setShowModal(false); setEditHabit(null); }}
          onSaved={fetchHabits}
        />
      )}
    </div>
  );
}
