import { Link } from 'react-router-dom';
import { useState } from 'react';
import { forgotPassword } from '../api';
import { AuthShell } from './Login';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await forgotPassword({ email });
      setMessage(data.message);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell title="Recover access" subtitle="Google accounts can sign in with Google again and set a password from Profile.">
      <form onSubmit={submit} className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
        {message && <p className="text-sm font-medium text-gray-500">{message}</p>}
        <button disabled={saving} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60">
          {saving ? 'Sending...' : 'Send recovery instructions'}
        </button>
      </form>
      <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-brand-600">Back to sign in</Link>
    </AuthShell>
  );
}
