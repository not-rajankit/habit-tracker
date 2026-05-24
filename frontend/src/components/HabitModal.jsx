import { useState, useEffect } from 'react';
import { createHabit, updateHabit } from '../api';

const EMOJI_OPTIONS = ['✅', '💪', '📖', '💧', '🧘', '🏃', '✍️', '🎵', '💤', '🥗', '🧠', '🎯'];

export default function HabitModal({ habit, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [icon, setIcon] = useState('✅');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setFrequency(habit.frequency);
      setIcon(habit.icon || '✅');
      setCategory(habit.category || '');
    }
  }, [habit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (habit?.id) {
        await updateHabit(habit.id, { name, frequency, icon, category: category || null });
      } else {
        await createHabit({ name, frequency, icon, category: category || null });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {habit ? 'Edit Habit' : 'New Habit'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-gray-400 hover:bg-surface-200 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Habit Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 10 pages"
              className="w-full px-4 py-3 rounded-xl bg-surface-100 border-0 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
              autoFocus
            />
          </div>

          {/* Emoji */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                    icon === emoji
                      ? 'bg-brand-100 ring-2 ring-brand-400 scale-110'
                      : 'bg-surface-100 hover:bg-surface-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Frequency</label>
            <div className="flex gap-2">
              {['daily', 'weekly'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    frequency === f
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                      : 'bg-surface-100 text-gray-500 hover:bg-surface-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Category (optional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Health, Learning"
              className="w-full px-4 py-3 rounded-xl bg-surface-100 border-0 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-200 active:scale-[0.98]"
          >
            {saving ? 'Saving...' : habit ? 'Update Habit' : 'Create Habit'}
          </button>
        </form>
      </div>
    </div>
  );
}
