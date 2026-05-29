import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { googleAuthUrl } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const from = location.state?.from?.pathname || '/';

  if (user) return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue tracking your habits.">
      <a href={googleAuthUrl('login')} className="flex w-full items-center justify-center rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm hover:bg-surface-50">
        Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-gray-300">
        <span className="h-px flex-1 bg-surface-200" /> Email <span className="h-px flex-1 bg-surface-200" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Email" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Password" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        <button disabled={saving} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
          {saving ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="font-semibold text-brand-600">Forgot password?</Link>
        <Link to="/signup" className="font-semibold text-gray-500">Create account</Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <main className="min-h-screen bg-surface-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-500">Habit Tracker</p>
          <h1 className="mt-2 text-3xl font-black text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        </div>
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          {children}
        </section>
      </div>
    </main>
  );
}
