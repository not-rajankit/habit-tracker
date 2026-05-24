const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Habits
export const getHabits = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/habits${qs ? `?${qs}` : ''}`);
};
export const createHabit = (data) => request('/habits', { method: 'POST', body: JSON.stringify(data) });
export const updateHabit = (id, data) => request(`/habits/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const updateHabitOrder = (habit_ids) => request('/habits/order', { method: 'PUT', body: JSON.stringify({ habit_ids }) });
export const archiveHabit = (id, archived) => updateHabit(id, { archived });
export const deleteHabit = (id) => request(`/habits/${id}`, { method: 'DELETE' });
export const deleteHabitPermanent = (id) => request(`/habits/${id}/permanent`, { method: 'DELETE' });

// Entries
export const toggleEntry = (habit_id, date) => request('/entries/toggle', { method: 'POST', body: JSON.stringify({ habit_id, date }) });
export const getEntries = (params) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/entries?${qs}`);
};

// Goals
export const getGoals = () => request('/goals');
export const createGoal = (data) => request('/goals', { method: 'POST', body: JSON.stringify(data) });
export const updateGoal = (id, data) => request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteGoal = (id) => request(`/goals/${id}`, { method: 'DELETE' });

// Summary
export const getWeeklySummary = (date) => request(`/summary/weekly${date ? `?date=${date}` : ''}`);
export const getMonthlySummary = (date) => request(`/summary/monthly${date ? `?date=${date}` : ''}`);
