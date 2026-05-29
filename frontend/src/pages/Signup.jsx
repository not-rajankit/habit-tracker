import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { googleAuthUrl } from '../api';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from './Login';

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await signup(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Start with email, or use Google and add a password later.">
      <a href={googleAuthUrl('login')} className="flex w-full items-center justify-center rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm hover:bg-surface-50">
        Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-gray-300">
        <span className="h-px flex-1 bg-surface-200" /> Email <span className="h-px flex-1 bg-surface-200" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" autoComplete="email" placeholder="Email" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" autoComplete="new-password" placeholder="Password" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        <button disabled={saving} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
          {saving ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account? <Link to="/login" className="font-semibold text-brand-600">Sign in</Link>
      </p>
    </AuthShell>
  );
}
