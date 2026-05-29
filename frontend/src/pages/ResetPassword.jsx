import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { resetPassword } from '../api';
import { AuthShell } from './Login';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const token = params.get('token') || '';

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await resetPassword({ token, password });
      setMessage('Password updated. You can sign in now.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
      <form onSubmit={submit} className="space-y-3">
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="New password" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        {message && <p className="text-sm font-medium text-gray-500">{message}</p>}
        <button disabled={saving || !token} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60">
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </form>
      <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-brand-600">Back to sign in</Link>
    </AuthShell>
  );
}
