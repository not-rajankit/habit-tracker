import { useState } from 'react';
import { changePassword, googleAuthUrl, updateProfile } from '../api';
import { useAuth } from '../auth/AuthContext';
import { themes, useTheme } from '../theme/ThemeContext.jsx';
import { AvatarBadge, avatarStyles, getAvatarStyleLabel, useAvatar } from '../avatar/AvatarContext.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { avatarStyle, setAvatarStyle } = useAvatar();
  const [name, setName] = useState(user?.name || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const displayName = user?.name?.trim() || 'Your profile';

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
    <div className="py-8 space-y-6">
      <header className="relative overflow-hidden rounded-[28px] border border-surface-200 bg-white p-6 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-transparent to-surface-100 opacity-80" />
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <AvatarBadge user={user} size="xl" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Profile</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">{displayName}</h1>
              <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
              Password {user?.has_password ? 'enabled' : 'not set'}
            </span>
            <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
              Google {user?.google_linked ? 'linked' : 'not linked'}
            </span>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Theme: {themes.find((item) => item.value === theme)?.label || 'Light'}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[24px] border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Account</h2>
              <p className="mt-2 text-sm text-gray-500">Keep the display name used across your tracker.</p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none placeholder:text-gray-300 focus:border-brand-200 focus:bg-white focus:ring-4 focus:ring-brand-100"
                placeholder="Your name"
              />
            </label>
            {profileMessage && <p className="text-sm font-medium text-gray-500">{profileMessage}</p>}
            <button className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-brand-100 hover:bg-brand-700">
              Save profile
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-surface-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Sign-in methods</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
              <span className="font-medium text-gray-500">Password</span>
              <span className={`font-semibold ${user?.has_password ? 'text-gray-800' : 'text-gray-400'}`}>
                {user?.has_password ? 'Enabled' : 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
              <span className="font-medium text-gray-500">Google</span>
              <span className={`font-semibold ${user?.google_linked ? 'text-gray-800' : 'text-gray-400'}`}>
                {user?.google_linked ? 'Linked' : 'Not linked'}
              </span>
            </div>
          </div>
          {!user?.google_linked && (
            <a
              href={googleAuthUrl('link')}
              className="mt-5 inline-flex rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-surface-50"
            >
              Link Google
            </a>
          )}
        </section>

        <section className="rounded-[24px] border border-surface-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Settings</h2>
              <p className="mt-2 text-sm text-gray-500">
                Theme and security stay tucked away until you need them.
              </p>
            </div>
            <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-semibold text-gray-500">
              2 options
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <details className="group rounded-2xl border border-surface-200 bg-surface-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">Avatar</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Current: {getAvatarStyleLabel(avatarStyle)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <AvatarBadge user={user} size="sm" />
                  <span className="text-lg text-gray-400 transition-transform group-open:rotate-180">⌄</span>
                </div>
              </summary>
              <div className="border-t border-surface-200 px-4 pb-4 pt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {avatarStyles.map((option) => {
                    const active = avatarStyle === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAvatarStyle(option.value)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          active
                            ? 'border-brand-300 bg-brand-50 shadow-sm'
                            : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <AvatarBadge user={user} variant={option.value} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800">{option.label}</span>
                              {active && (
                                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">{option.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>

            <details className="group rounded-2xl border border-surface-200 bg-surface-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">Theme</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Current: {themes.find((item) => item.value === theme)?.label || 'Light'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                    {themes.find((item) => item.value === theme)?.label || 'Light'}
                  </span>
                  <span className="text-lg text-gray-400 transition-transform group-open:rotate-180">⌄</span>
                </div>
              </summary>
              <div className="border-t border-surface-200 px-4 pb-4 pt-3">
                <div className="grid gap-3">
                  {themes.map((option) => {
                    const active = theme === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTheme(option.value)}
                        className={`group rounded-2xl border p-4 text-left transition-all ${
                          active
                            ? 'border-brand-300 bg-brand-50 shadow-sm'
                            : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-[11px] font-black uppercase tracking-widest ${
                              active ? 'border-brand-200 bg-white text-brand-600' : 'border-surface-200 bg-surface-50 text-gray-400'
                            }`}
                            aria-hidden="true"
                          >
                            {option.value.slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800">{option.label}</span>
                              {active && (
                                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm leading-5 text-gray-500">{option.description}</p>
                          </div>
                          <span
                            className={`mt-1 h-3 w-3 rounded-full border ${
                              active ? 'border-brand-600 bg-brand-600' : 'border-surface-300 bg-transparent'
                            }`}
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>

            <details className="group rounded-2xl border border-surface-200 bg-surface-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {user?.has_password ? 'Change password' : 'Create password'}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Update your sign-in password without changing anything else.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Security
                  </span>
                  <span className="text-lg text-gray-400 transition-transform group-open:rotate-180">⌄</span>
                </div>
              </summary>
              <div className="border-t border-surface-200 px-4 pb-4 pt-3">
                <form onSubmit={savePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  {user?.has_password && (
                    <input
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      type="password"
                      placeholder="Current password"
                      className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-gray-300 focus:border-brand-200 focus:ring-4 focus:ring-brand-100"
                    />
                  )}
                  <input
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    type="password"
                    placeholder="New password"
                    className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-gray-300 focus:border-brand-200 focus:ring-4 focus:ring-brand-100"
                  />
                  <button className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-gray-800">
                    {user?.has_password ? 'Change' : 'Create'}
                  </button>
                </form>
                {passwordMessage && <p className="mt-3 text-sm font-medium text-gray-500">{passwordMessage}</p>}
              </div>
            </details>
          </div>
        </section>
      </div>

      <div className="flex justify-start">
        <button
          onClick={logout}
          className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-100"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
