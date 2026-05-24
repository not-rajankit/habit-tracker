import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  archiveHabit,
  deleteGoal,
  deleteHabitPermanent,
  getGoals,
  getHabits,
} from '../api';
import GoalModal from '../components/GoalModal';
import HabitModal from '../components/HabitModal';

export default function Manage() {
  const [habits, setHabits] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('habits');
  const [habitModalTarget, setHabitModalTarget] = useState(null);
  const [goalModalTarget, setGoalModalTarget] = useState(null);
  const [savingId, setSavingId] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [habitData, goalData] = await Promise.all([
        getHabits({ include_archived: true }),
        getGoals(),
      ]);
      setHabits(habitData);
      setGoals(goalData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredHabits = useMemo(() => {
    const term = search.trim().toLowerCase();
    return habits.filter((habit) =>
      [habit.name, habit.frequency, habit.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [habits, search]);

  const filteredGoals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return goals.filter((goal) =>
      [goal.title, goal.description, goal.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [goals, search]);

  const handleArchiveHabit = async (habit) => {
    setSavingId(`habit-${habit.id}`);
    try {
      await archiveHabit(habit.id, !habit.archived);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId('');
    }
  };

  const handleDeleteHabit = async (habit) => {
    if (!confirm(`Permanently delete "${habit.name}" and its history?`)) return;
    setSavingId(`habit-${habit.id}`);
    try {
      await deleteHabitPermanent(habit.id);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId('');
    }
  };

  const handleDeleteGoal = async (goal) => {
    if (!confirm(`Delete "${goal.title}"?`)) return;
    setSavingId(`goal-${goal.id}`);
    try {
      await deleteGoal(goal.id);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId('');
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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage</h1>
          <p className="mt-1 text-xs text-gray-400">
            {habits.length} habits, {goals.length} goals
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHabitModalTarget({})}
            className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            New Habit
          </button>
          <button
            type="button"
            onClick={() => setGoalModalTarget({})}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm hover:bg-surface-50"
          >
            New Goal
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[auto_1fr]">
        <div className="flex rounded-xl bg-surface-100 p-1">
          {['habits', 'goals'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                activeTab === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="min-w-0 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-300 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {activeTab === 'habits' ? (
        <div className="overflow-hidden rounded-2xl border border-surface-200/70 bg-white shadow-sm">
          {filteredHabits.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">No habits found.</div>
          ) : (
            <div className="divide-y divide-surface-100">
              {filteredHabits.map((habit) => (
                <div key={habit.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{habit.icon}</span>
                      <h2 className={`truncate text-sm font-bold ${habit.archived ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {habit.name}
                      </h2>
                      <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-gray-400">
                        {habit.frequency}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {habit.category || 'No category'} · current streak {habit.current_streak || 0} · best {habit.best_streak || 0}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setHabitModalTarget(habit)}
                      className="rounded-lg bg-surface-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-surface-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchiveHabit(habit)}
                      disabled={savingId === `habit-${habit.id}`}
                      className="rounded-lg bg-surface-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-surface-200 disabled:opacity-40"
                    >
                      {habit.archived ? 'Restore' : 'Archive'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHabit(habit)}
                      disabled={savingId === `habit-${habit.id}`}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-100 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-surface-200/70 bg-white shadow-sm">
          {filteredGoals.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">No goals found.</div>
          ) : (
            <div className="divide-y divide-surface-100">
              {filteredGoals.map((goal) => (
                <div key={goal.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-gray-800">{goal.title}</h2>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-600">
                        {goal.type}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-400">
                      {goal.type === 'small'
                        ? `${goal.progress || 0}/${goal.target || 1}${goal.deadline ? ` · due ${new Date(goal.deadline).toLocaleDateString()}` : ''}`
                        : goal.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setGoalModalTarget(goal)}
                      className="rounded-lg bg-surface-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-surface-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal)}
                      disabled={savingId === `goal-${goal.id}`}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-100 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {habitModalTarget && (
        <HabitModal
          habit={habitModalTarget.id ? habitModalTarget : null}
          onClose={() => setHabitModalTarget(null)}
          onSaved={fetchData}
        />
      )}

      {goalModalTarget && (
        <GoalModal
          goal={goalModalTarget.id ? goalModalTarget : null}
          onClose={() => setGoalModalTarget(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
