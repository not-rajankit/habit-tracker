import { useState, useEffect } from 'react';
import { createGoal, updateGoal, getHabits } from '../api';

export default function GoalModal({ goal, onClose, onSaved }) {
  const [type, setType] = useState('small');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState(1);
  const [deadline, setDeadline] = useState('');
  const [linkedHabitIds, setLinkedHabitIds] = useState([]);
  const [habits, setHabits] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHabits().then(setHabits).catch(console.error);
    if (goal) {
      setType(goal.type);
      setTitle(goal.title);
      setDescription(goal.description || '');
      setTarget(goal.target || 1);
      setDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
      setLinkedHabitIds(goal.linked_habit_ids || []);
    }
  }, [goal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const data = { type, title, description: description || null, target, deadline: deadline || null, linked_habit_ids: linkedHabitIds };
      if (goal?.id) {
        await updateGoal(goal.id, data);
      } else {
        await createGoal(data);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleHabitLink = (id) => {
    setLinkedHabitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 animate-slide-up max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">{goal ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-gray-400 hover:bg-surface-200">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="flex gap-2">
            {['small', 'big'].map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === t ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'bg-surface-100 text-gray-500 hover:bg-surface-200'}`}>
                {t === 'small' ? '🎯 Small Goal' : '🌟 Big Goal'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Workout 5 times this week"
              className="w-full px-4 py-3 rounded-xl bg-surface-100 border-0 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200" autoFocus />
          </div>

          {type === 'big' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your vision..."
                className="w-full px-4 py-3 rounded-xl bg-surface-100 border-0 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none h-20" />
            </div>
          )}

          {type === 'small' && (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Target</label>
                  <input type="number" value={target} onChange={(e) => setTarget(parseInt(e.target.value) || 1)} min={1}
                    className="w-full px-4 py-3 rounded-xl bg-surface-100 border-0 text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-surface-100 border-0 text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                </div>
              </div>
            </>
          )}

          {/* Link habits */}
          {habits.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Link Habits</label>
              <div className="flex flex-wrap gap-2">
                {habits.map((h) => (
                  <button key={h.id} type="button" onClick={() => toggleHabitLink(h.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${linkedHabitIds.includes(h.id) ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300' : 'bg-surface-100 text-gray-500 hover:bg-surface-200'}`}>
                    {h.icon} {h.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={!title.trim() || saving}
            className="w-full py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-40 transition-all shadow-lg shadow-brand-200 active:scale-[0.98]">
            {saving ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
          </button>
        </form>
      </div>
    </div>
  );
}
