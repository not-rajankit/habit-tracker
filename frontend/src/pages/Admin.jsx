import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../auth/AuthContext';
import {
  createAdminCategory,
  createAdminPack,
  createAdminTemplate,
  deleteAdminCategory,
  deleteAdminPack,
  deleteAdminTemplate,
  getAdminAnalytics,
  getAdminCategories,
  getAdminOverview,
  getAdminPacks,
  getAdminRoles,
  getAdminTemplates,
  getAdminUsers,
  updateAdminCategory,
  updateAdminPack,
  updateAdminTemplate,
  updateAdminUserRoles,
  updateAdminUserStatus,
} from '../api';

ModuleRegistry.registerModules([AllCommunityModule]);

const adminPermissions = [
  'manage_users',
  'manage_templates',
  'manage_categories',
  'manage_packs',
  'view_analytics',
  'manage_roles',
  'manage_system_settings',
];

const navItems = [
  { to: '/admin/dashboard', label: 'Overview', permission: 'view_analytics' },
  { to: '/admin/users', label: 'Users', permission: 'manage_users' },
  { to: '/admin/analytics', label: 'Analytics', permission: 'view_analytics' },
  { to: '/admin/templates', label: 'Templates', permission: 'manage_templates' },
  { to: '/admin/categories', label: 'Categories', permission: 'manage_categories' },
  { to: '/admin/packs', label: 'Packs', permission: 'manage_packs' },
  { to: '/admin/roles', label: 'Roles', permission: 'manage_roles' },
  { to: '/admin/settings', label: 'Settings', permission: 'manage_system_settings' },
];

function Grid({ rows, columns, emptyText = 'No records found.' }) {
  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 130,
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  return (
    <div className="min-h-[280px] overflow-hidden rounded-xl border border-surface-200 bg-white">
      {(rows || []).length === 0 ? (
        <div className="grid min-h-[280px] place-items-center px-4 text-center text-sm font-semibold text-gray-400">
          {emptyText}
        </div>
      ) : (
        <div className="ag-theme-quartz h-[520px] w-full">
          <AgGridReact
            rowData={rows}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            pagination
            paginationPageSize={12}
            suppressCellFocus
          />
        </div>
      )}
    </div>
  );
}

function Panel({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function AdminLayout() {
  const { hasAnyPermission, hasPermission } = useAuth();
  if (!hasAnyPermission(adminPermissions)) return <Navigate to="/" replace />;

  const visibleNav = navItems.filter((item) => hasPermission(item.permission));

  return (
    <div className="min-h-screen bg-surface-50 lg:flex">
      <aside className="border-b border-surface-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="px-4 py-4">
          <NavLink to="/" className="text-xs font-bold uppercase tracking-wide text-gray-400">Habit Tracker</NavLink>
          <h1 className="mt-1 text-xl font-bold text-gray-900">Admin</h1>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-surface-100'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="w-full px-4 py-6 lg:ml-60 lg:px-8">
        <Routes>
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/users" element={<Users />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/templates" element={<TemplatesAdmin />} />
          <Route path="/templates/create" element={<TemplatesAdmin createMode />} />
          <Route path="/templates/:id" element={<TemplatesAdmin />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/packs" element={<Packs />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function useLoad(loader, initialValue) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loader());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

async function runAdminAction(action, successMessage = '') {
  try {
    await action();
    if (successMessage) window.alert(successMessage);
  } catch (err) {
    window.alert(err.message || 'Action failed');
  }
}

function Status({ loading, error }) {
  if (loading) return <div className="py-8 text-sm font-semibold text-gray-400">Loading...</div>;
  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>;
  return null;
}

function Overview() {
  const loader = useCallback(() => getAdminOverview(), []);
  const { data, loading, error } = useLoad(loader, { metrics: {}, activity: [], popular_templates: [], recent_admin_activity: [] });
  const metrics = data.metrics || {};
  const tiles = [
    ['Total users', metrics.total_users],
    ['Active today', metrics.active_today],
    ['Active 7d', metrics.active_7d],
    ['Active 30d', metrics.active_30d],
    ['New signups 7d', metrics.new_signups_7d],
    ['Template imports', metrics.template_adoption_count],
  ];

  return (
    <div className="space-y-5">
      <Status loading={loading} error={error} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value ?? 0}</p>
          </div>
        ))}
      </div>
      <Panel title="Popular Templates">
        <Grid
          rows={data.popular_templates || []}
          emptyText="No template imports yet. Seeded templates will appear here after migrations, and usage counts rise when users import them."
          columns={[
            { field: 'title' },
            { field: 'category_name', headerName: 'Category' },
            { field: 'usage_count', headerName: 'Imports' },
          ]}
        />
      </Panel>
    </div>
  );
}

function Users() {
  const { hasPermission } = useAuth();
  const loader = useCallback(() => getAdminUsers(), []);
  const { data, loading, error, reload } = useLoad(loader, []);

  const columns = useMemo(() => [
    { field: 'name' },
    { field: 'email', minWidth: 220 },
    { field: 'status' },
    { field: 'roles', valueFormatter: (params) => (params.value || []).join(', ') },
    { field: 'created_at', headerName: 'Signup', valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '' },
    { field: 'last_active_at', headerName: 'Last active', valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '' },
    {
      headerName: 'Actions',
      minWidth: 210,
      cellRenderer: (params) => (
        <div className="flex gap-2 py-1">
          {hasPermission('suspend_users') && (
            <button
              type="button"
              onClick={async () => {
                await runAdminAction(async () => {
                  await updateAdminUserStatus(params.data.id, params.data.status === 'suspended' ? 'active' : 'suspended');
                  await reload();
                }, 'User status updated.');
              }}
              className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-gray-600"
            >
              {params.data.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </button>
          )}
        </div>
      ),
    },
  ], [hasPermission, reload]);

  return (
    <Panel title="Users">
      <Status loading={loading} error={error} />
      {!loading && !error && <Grid rows={data} columns={columns} />}
    </Panel>
  );
}

function Analytics() {
  const loader = useCallback(() => getAdminAnalytics(), []);
  const { data, loading, error } = useLoad(loader, { events: [], categories: [], retention: {} });
  return (
    <div className="space-y-5">
      <Status loading={loading} error={error} />
      <Panel title="Event Activity">
        <Grid rows={data.events || []} emptyText="No analytics events have been captured yet." columns={[{ field: 'date' }, { field: 'event_name' }, { field: 'count' }]} />
      </Panel>
      <Panel title="Category Imports">
        <Grid rows={data.categories || []} emptyText="No category import activity yet. Categories still appear after migrations even before imports." columns={[{ field: 'name' }, { field: 'imports' }]} />
      </Panel>
      <Panel title="Retention">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Signups', data.retention?.signup_count],
            ['Day 1', data.retention?.day_1],
            ['Day 7', data.retention?.day_7],
            ['Day 30', data.retention?.day_30],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-100 p-4">
              <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{value || 0}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Categories() {
  const loader = useCallback(() => getAdminCategories(), []);
  const { data, loading, error, reload } = useLoad(loader, []);
  const [form, setForm] = useState({ name: '', slug: '', icon: '', sort_order: 0 });

  const save = async () => {
    await runAdminAction(async () => {
      if (form.id) await updateAdminCategory(form.id, form);
      else await createAdminCategory(form);
      setForm({ name: '', slug: '', icon: '', sort_order: 0 });
      await reload();
    }, form.id ? 'Category updated.' : 'Category created.');
  };

  return (
    <Panel title="Categories" action={<FormButton onClick={save} label={form.id ? 'Update' : 'Create'} />}>
      <Status loading={loading} error={error} />
      <SimpleForm fields={['name', 'slug', 'icon', 'sort_order']} form={form} setForm={setForm} />
      <Grid
        rows={data}
        columns={[
          { field: 'name' },
          { field: 'slug' },
          { field: 'icon' },
          { field: 'sort_order' },
          { headerName: 'Actions', cellRenderer: (params) => <RowActions onEdit={() => setForm(params.data)} onDelete={async () => runAdminAction(async () => { await deleteAdminCategory(params.data.id); await reload(); }, 'Category deleted.')} /> },
        ]}
        emptyText="No categories found. Use the form above to create one."
      />
    </Panel>
  );
}

function TemplatesAdmin() {
  const navigate = useNavigate();
  const templatesLoader = useCallback(() => getAdminTemplates(), []);
  const categoriesLoader = useCallback(() => getAdminCategories(), []);
  const { data, loading, error, reload } = useLoad(templatesLoader, []);
  const categories = useLoad(categoriesLoader, []).data;
  const [form, setForm] = useState(emptyTemplate());

  const save = async () => {
    await runAdminAction(async () => {
      const payload = normalizeBooleans(form, ['is_featured', 'is_active']);
      if (payload.id) await updateAdminTemplate(payload.id, payload);
      else await createAdminTemplate(payload);
      setForm(emptyTemplate());
      await reload();
      navigate('/admin/templates');
    }, form.id ? 'Template updated.' : 'Template created.');
  };

  return (
    <Panel title="Templates" action={<FormButton onClick={save} label={form.id ? 'Update' : 'Create'} />}>
      <Status loading={loading} error={error} />
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <SimpleInput field="title" form={form} setForm={setForm} />
        <SimpleInput field="icon" form={form} setForm={setForm} />
        <select value={form.category_id || ''} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value || null }))} className="rounded-xl border border-surface-200 px-3 py-2 text-sm">
          <option value="">No category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <SimpleInput field="difficulty" form={form} setForm={setForm} />
        <select value={form.frequency_type} onChange={(event) => setForm((current) => ({ ...current, frequency_type: event.target.value }))} className="rounded-xl border border-surface-200 px-3 py-2 text-sm">
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
        </select>
        <SimpleInput field="default_goal" form={form} setForm={setForm} />
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-500">
          <input type="checkbox" checked={Boolean(form.is_featured)} onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))} />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-500">
          <input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
          Active
        </label>
        <textarea value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="description" className="rounded-xl border border-surface-200 px-3 py-2 text-sm md:col-span-3" />
      </div>
      <Grid
        rows={data}
        columns={[
          { field: 'title' },
          { field: 'category_name', headerName: 'Category' },
          { field: 'frequency_type', headerName: 'Frequency' },
          { field: 'usage_count', headerName: 'Imports' },
          { field: 'is_active', headerName: 'Active' },
          { headerName: 'Actions', cellRenderer: (params) => <RowActions onEdit={() => setForm({ ...emptyTemplate(), ...params.data })} onDelete={async () => runAdminAction(async () => { await deleteAdminTemplate(params.data.id); await reload(); }, 'Template deleted.')} /> },
        ]}
        emptyText="No templates found. Seeded templates appear after migrations, or create one above."
      />
    </Panel>
  );
}

function Packs() {
  const packsLoader = useCallback(() => getAdminPacks(), []);
  const templatesLoader = useCallback(() => getAdminTemplates(), []);
  const { data, loading, error, reload } = useLoad(packsLoader, []);
  const templates = useLoad(templatesLoader, []).data;
  const [form, setForm] = useState({ title: '', description: '', is_featured: false, template_ids: [] });

  const save = async () => {
    await runAdminAction(async () => {
      const payload = normalizeBooleans(form, ['is_featured']);
      if (payload.id) await updateAdminPack(payload.id, payload);
      else await createAdminPack(payload);
      setForm({ title: '', description: '', is_featured: false, template_ids: [] });
      await reload();
    }, form.id ? 'Pack updated.' : 'Pack created.');
  };

  return (
    <Panel title="Habit Packs" action={<FormButton onClick={save} label={form.id ? 'Update' : 'Create'} />}>
      <Status loading={loading} error={error} />
      <p className="mb-4 text-sm text-gray-500">
        Packs are curated bundles of habit templates. A user can import one pack and receive private copies of every template inside it.
      </p>
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <SimpleInput field="title" form={form} setForm={setForm} />
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-500">
          <input type="checkbox" checked={Boolean(form.is_featured)} onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))} />
          Featured
        </label>
        <textarea value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="description" className="rounded-xl border border-surface-200 px-3 py-2 text-sm md:col-span-2" />
        <select
          multiple
          value={form.template_ids || []}
          onChange={(event) => setForm((current) => ({ ...current, template_ids: Array.from(event.target.selectedOptions).map((option) => option.value) }))}
          className="h-36 rounded-xl border border-surface-200 px-3 py-2 text-sm md:col-span-2"
        >
          {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
        </select>
      </div>
      <Grid
        rows={data}
        columns={[
          { field: 'title' },
          { field: 'description' },
          { field: 'is_featured', headerName: 'Featured' },
          { field: 'template_titles', headerName: 'Templates', valueFormatter: (params) => (params.value || []).join(', ') },
          { headerName: 'Actions', cellRenderer: (params) => <RowActions onEdit={() => setForm({ ...params.data, template_ids: params.data.template_ids || [] })} onDelete={async () => runAdminAction(async () => { await deleteAdminPack(params.data.id); await reload(); }, 'Pack deleted.')} /> },
        ]}
        emptyText="No packs found. Select templates above to create a bundle."
      />
    </Panel>
  );
}

function Roles() {
  const usersLoader = useCallback(() => getAdminUsers(), []);
  const rolesLoader = useCallback(() => getAdminRoles(), []);
  const { data, loading, error, reload } = useLoad(usersLoader, []);
  const roles = useLoad(rolesLoader, []).data;

  return (
    <Panel title="Roles">
      <Status loading={loading} error={error} />
      <Grid
        rows={data}
        columns={[
          { field: 'email', minWidth: 220 },
          { field: 'name' },
          { field: 'roles', valueFormatter: (params) => (params.value || []).join(', ') },
          {
            headerName: 'Assign',
            minWidth: 240,
            cellRenderer: (params) => (
              <div className="flex gap-2 py-1">
                {roles.filter((role) => ['Admin', 'User'].includes(role.name)).map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={async () => {
                      const current = new Set(params.data.roles || []);
                      if (current.has(role.name)) current.delete(role.name);
                      else current.add(role.name);
                      await runAdminAction(async () => {
                        await updateAdminUserRoles(params.data.id, Array.from(current).filter((name) => ['Admin', 'User'].includes(name)));
                        await reload();
                      }, 'User roles updated.');
                    }}
                    className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-gray-600"
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            ),
          },
        ]}
      />
    </Panel>
  );
}

function Settings() {
  return (
    <Panel title="System Settings">
      <p className="text-sm text-gray-500">Platform content and analytics controls are enabled. Additional settings can be added behind this permission gate.</p>
    </Panel>
  );
}

function FormButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">
      {label}
    </button>
  );
}

function SimpleInput({ field, form, setForm }) {
  return (
    <input
      value={form[field] ?? ''}
      onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
      placeholder={field}
      className="rounded-xl border border-surface-200 px-3 py-2 text-sm"
    />
  );
}

function SimpleForm({ fields, form, setForm }) {
  return (
    <div className="mb-4 grid gap-2 md:grid-cols-4">
      {fields.map((field) => <SimpleInput key={field} field={field} form={form} setForm={setForm} />)}
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex gap-2 py-1">
      <button type="button" onClick={onEdit} className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-gray-600">Edit</button>
      <button type="button" onClick={onDelete} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">Delete</button>
    </div>
  );
}

function emptyTemplate() {
  return {
    title: '',
    description: '',
    category_id: '',
    icon: '',
    color: '',
    difficulty: '',
    frequency_type: 'daily',
    default_goal: 1,
    is_featured: false,
    is_active: true,
  };
}

function normalizeBooleans(form, fields) {
  return fields.reduce((payload, field) => ({ ...payload, [field]: Boolean(payload[field]) }), { ...form });
}

export default AdminLayout;
