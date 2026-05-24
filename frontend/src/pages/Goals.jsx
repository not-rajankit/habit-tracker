import { useState, useEffect, useCallback } from 'react';
import { getGoals, deleteGoal } from '../api';
import GoalModal from '../components/GoalModal';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    try {
      const data = await getGoals();
      setGoals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await deleteGoal(id);
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const smallGoals = goals.filter(g => g.type === 'small');
  const bigGoals = goals.filter(g => g.type === 'big');

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Goals</h1>
        <button
          onClick={() => { setEditGoal(null); setShowModal(true); }}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all shadow-md shadow-brand-200 active:scale-95"
        >
          + New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-700">No goals yet</h3>
          <p className="text-sm text-gray-400 mt-1">Create a goal to give purpose to your habits</p>
        </div>
      ) : (
        <>
          {/* Small Goals */}
          {smallGoals.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">🎯 Short-term Goals</h2>
              <div className="space-y-3">
                {smallGoals.map((goal) => {
                  const progressPct = goal.target > 0 ? Math.min((goal.progress / goal.target) * 100, 100) : 0;
                  return (
                    <div key={goal.id} className="bg-white rounded-2xl p-4 shadow-sm border border-surface-200/60 animate-fade-in group relative">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-800 text-[15px]">{goal.title}</h3>
                        <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                          {goal.progress}/{goal.target}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-700"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {goal.deadline && (
                        <p className="text-[11px] text-gray-400 mt-2">Due: {new Date(goal.deadline).toLocaleDateString()}</p>
                      )}
                      {/* Actions */}
                      <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                        <button onClick={() => { setEditGoal(goal); setShowModal(true); }}
                          className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center text-xs text-gray-400 hover:bg-surface-200">✏️</button>
                        <button onClick={() => handleDelete(goal.id)}
                          className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center text-xs text-gray-400 hover:bg-red-50 hover:text-red-400">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Big Goals */}
          {bigGoals.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">🌟 Long-term Vision</h2>
              <div className="space-y-3">
                {bigGoals.map((goal) => (
                  <div key={goal.id} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100 animate-fade-in group relative">
                    <h3 className="font-semibold text-gray-800 text-[15px]">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{goal.description}</p>
                    )}
                    {goal.linked_habit_ids?.length > 0 && (
                      <p className="text-[11px] text-amber-600 mt-2 font-medium">
                        🔗 {goal.linked_habit_ids.length} linked habit{goal.linked_habit_ids.length > 1 ? 's' : ''}
                      </p>
                    )}
                    {/* Actions */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                      <button onClick={() => { setEditGoal(goal); setShowModal(true); }}
                        className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center text-xs text-gray-400 hover:bg-white">✏️</button>
                      <button onClick={() => handleDelete(goal.id)}
                        className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center text-xs text-gray-400 hover:bg-red-50 hover:text-red-400">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <GoalModal
          goal={editGoal}
          onClose={() => { setShowModal(false); setEditGoal(null); }}
          onSaved={fetchGoals}
        />
      )}
    </div>
  );
}
