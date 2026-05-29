import { useState } from 'react';
import { changePassword, googleAuthUrl, updateProfile } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [passwordMessage, setPasswordMessage] = useState('');

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    try {
      const data = await updateProfile({ name });
      setUser(data.user);
      setProfileMessage('Profile updated.');
    } catch (err) {
      setProfileMessage(err.message);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    try {
      const data = await changePassword(passwordForm);
      setUser(data.user);
      setPasswordForm({ current_password: '', new_password: '' });
      setPasswordMessage(user?.has_password ? 'Password changed.' : 'Password created.');
    } catch (err) {
      setPasswordMessage(err.message);
    }
  };

  return (
    <div className="py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
        </div>
        {user?.avatar_url && <img src={user.avatar_url} alt="" className="h-14 w-14 rounded-full border border-surface-200" />}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Account</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
            {profileMessage && <p className="text-sm font-medium text-gray-500">{profileMessage}</p>}
            <button className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Save profile</button>
          </form>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Sign-in methods</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-500">
            <p>Password: <span className="font-semibold text-gray-800">{user?.has_password ? 'Enabled' : 'Not set'}</span></p>
            <p>Google: <span className="font-semibold text-gray-800">{user?.google_linked ? 'Linked' : 'Not linked'}</span></p>
          </div>
          {!user?.google_linked && (
            <a href={googleAuthUrl('link')} className="mt-4 inline-flex rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-surface-50">
              Link Google
            </a>
          )}
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">{user?.has_password ? 'Change password' : 'Create password'}</h2>
          <form onSubmit={savePassword} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            {user?.has_password && (
              <input value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} type="password" placeholder="Current password" className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
            )}
            <input value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} type="password" placeholder="New password" className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
            <button className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white">{user?.has_password ? 'Change' : 'Create'}</button>
          </form>
          {passwordMessage && <p className="mt-3 text-sm font-medium text-gray-500">{passwordMessage}</p>}
        </section>
      </div>

      <button onClick={logout} className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600">
        Sign out
      </button>
    </div>
  );
}
