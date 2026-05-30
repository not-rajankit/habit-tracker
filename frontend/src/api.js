const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const googleAuthUrl = (intent = 'login') => `${API_BASE}/auth/google?intent=${encodeURIComponent(intent)}`;

// Auth
export const getCurrentUser = () => request('/auth/me');
export const signup = (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
export const login = (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const updateProfile = (data) => request('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
export const changePassword = (data) => request('/auth/password/change', { method: 'POST', body: JSON.stringify(data) });
export const forgotPassword = (data) => request('/auth/password/forgot', { method: 'POST', body: JSON.stringify(data) });
export const resetPassword = (data) => request('/auth/password/reset', { method: 'POST', body: JSON.stringify(data) });

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

// Focus sessions
export const getFocusSessions = (date) => request(`/focus-sessions${date ? `?date=${date}` : ''}`);
export const createFocusSession = (data) => request('/focus-sessions', { method: 'POST', body: JSON.stringify(data) });
export const deleteFocusSession = (id) => request(`/focus-sessions/${id}`, { method: 'DELETE' });

// Templates
export const getTemplateCategories = () => request('/templates/categories');
export const getTemplates = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/templates${qs ? `?${qs}` : ''}`);
};
export const getTemplatePacks = () => request('/templates/packs');
export const importTemplate = (id) => request(`/templates/${id}/import`, { method: 'POST' });
export const importTemplatePack = (id) => request(`/templates/packs/${id}/import`, { method: 'POST' });

// Admin
export const getAdminOverview = () => request('/admin/overview');
export const getAdminAnalytics = () => request('/admin/analytics');
export const getAdminUsers = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/admin/users${qs ? `?${qs}` : ''}`);
};
export const updateAdminUserStatus = (id, status) => request(`/admin/users/${id}/status`, {
  method: 'PATCH',
  body: JSON.stringify({ status }),
});
export const getAdminRoles = () => request('/admin/roles');
export const updateAdminUserRoles = (id, roles) => request(`/admin/users/${id}/roles`, {
  method: 'PUT',
  body: JSON.stringify({ roles }),
});
export const getAdminCategories = () => request('/admin/categories');
export const createAdminCategory = (data) => request('/admin/categories', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminCategory = (id, data) => request(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAdminCategory = (id) => request(`/admin/categories/${id}`, { method: 'DELETE' });
export const getAdminTemplates = () => request('/admin/templates');
export const createAdminTemplate = (data) => request('/admin/templates', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminTemplate = (id, data) => request(`/admin/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAdminTemplate = (id) => request(`/admin/templates/${id}`, { method: 'DELETE' });
export const getAdminPacks = () => request('/admin/packs');
export const createAdminPack = (data) => request('/admin/packs', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminPack = (id, data) => request(`/admin/packs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAdminPack = (id) => request(`/admin/packs/${id}`, { method: 'DELETE' });
