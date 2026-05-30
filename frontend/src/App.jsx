import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Home from './pages/Home';
import Summary from './pages/Summary';
import Goals from './pages/Goals';
import HabitTable from './pages/HabitTable';
import Manage from './pages/Manage';
import Pomodoro from './pages/Pomodoro';
import Templates from './pages/Templates';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import Profile from './pages/Profile';
import PomodoroAlarm from './components/PomodoroAlarm';
import { AvatarBadge } from './avatar/AvatarContext.jsx';

const navItems = [
  { to: '/', label: 'Today', icon: '☀️' },
  { to: '/table', label: 'Table', icon: '▦' },
  { to: '/pomodoro', label: 'Focus', icon: '⏱' },
  { to: '/summary', label: 'Summary', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/templates', label: 'Ideas', icon: '✦' },
  { to: '/manage', label: 'Manage', icon: '⚙️' },
  { to: '/profile', label: 'Profile', icon: '◎' },
];

const SIDEBAR_STORAGE_KEY = 'habit-tracker-sidebar-collapsed';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function ProtectedApp() {
  const { user, loading, hasAnyPermission } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // Ignore storage failures; the UI state still works for this session.
    }
  }, [sidebarCollapsed]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-50 text-sm font-bold text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (location.pathname.startsWith('/admin')) {
    return (
      <>
        <PomodoroAlarm />
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </>
    );
  }

  const visibleNavItems = hasAnyPermission([
    'manage_users',
    'manage_templates',
    'manage_categories',
    'manage_packs',
    'view_analytics',
    'manage_roles',
    'manage_system_settings',
  ])
    ? [...navItems, { to: '/admin/dashboard', label: 'Admin', icon: '▣' }]
    : navItems;
  const profileNavItem = { to: '/profile', label: 'Profile', icon: '◎' };
  const mainNavItems = visibleNavItems.filter((item) => item.to !== profileNavItem.to);
  const sidebarWidthClass = sidebarCollapsed ? 'lg:w-24' : 'lg:w-56';
  const mainPaddingClass = sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-56';
  const navItemAlignmentClass = sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'lg:justify-start lg:px-3';
  const profileAlignmentClass = sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'lg:justify-start lg:px-2';
  const collapsedIconClass = sidebarCollapsed ? 'lg:text-2xl' : 'lg:text-lg';

  return (
      <div className="min-h-screen bg-surface-50 lg:flex">
        <PomodoroAlarm />

        {/* Main content */}
        <main className={`flex-1 w-full max-w-6xl mx-auto pb-24 lg:pb-8 ${mainPaddingClass} px-4 sm:px-6 lg:px-8 lg:transition-[padding-left] lg:duration-300 lg:ease-out`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/table" element={<HabitTable />} />
            <Route path="/pomodoro" element={<Pomodoro />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/weekly" element={<Summary initialView="week" />} />
            <Route path="/monthly" element={<Summary initialView="month" />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/manage" element={<Manage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Bottom navigation */}
        <nav className={`theme-nav-surface fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-surface-200 z-50 lg:top-0 lg:right-auto ${sidebarWidthClass} lg:border-t-0 lg:border-r lg:transition-[width] lg:duration-300 lg:ease-out`}>
          <div className="mx-auto flex max-w-full justify-start gap-1 overflow-x-auto px-2 py-2 lg:max-w-none lg:h-full lg:flex-col lg:overflow-visible lg:px-3 lg:py-4 lg:transition-[padding] lg:duration-300 lg:ease-out">
            <div className="hidden lg:flex items-center justify-between gap-2 px-2 pb-3">
              <div className={`min-w-0 overflow-hidden transition-all duration-300 ease-out ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-40 opacity-100 translate-x-0'}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Navigation</p>
                <p className="mt-1 truncate text-sm font-semibold text-gray-700">Habit Tracker</p>
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-surface-200 bg-white text-gray-500 shadow-sm hover:bg-surface-50 hover:text-gray-700"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <span className="text-base leading-none">{sidebarCollapsed ? '›' : '‹'}</span>
              </button>
            </div>

            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `group relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all lg:w-full lg:flex-row lg:gap-3 lg:py-3 lg:text-sm ${navItemAlignmentClass} ${
                    isActive
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                <span className={`${collapsedIconClass}`}>{item.icon}</span>
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${sidebarCollapsed ? 'lg:max-w-0 lg:opacity-0 lg:translate-x-[-4px]' : 'lg:max-w-32 lg:opacity-100 lg:translate-x-0'}`}>
                  {item.label}
                </span>
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg lg:group-hover:block">
                  {item.label}
                </span>
              </NavLink>
            ))}
            <div className="mt-auto w-full pt-3 lg:border-t lg:border-surface-200/80">
              <NavLink
                to={profileNavItem.to}
                title={profileNavItem.label}
                className={({ isActive }) =>
                  `group relative profile-nav-link flex w-full min-w-[120px] items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium transition-all lg:min-w-0 lg:gap-3 lg:py-2.5 lg:text-sm ${profileAlignmentClass} ${
                    isActive
                      ? 'bg-white text-brand-700 ring-1 ring-brand-100 shadow-sm'
                      : 'text-gray-400 hover:bg-surface-100 hover:text-gray-700'
                  }`
                }
                aria-label="Profile settings"
              >
                <AvatarBadge user={user} size={sidebarCollapsed ? 'lg' : 'md'} className="border border-white/70 ring-1 ring-surface-200" />
                <div className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-out ${sidebarCollapsed ? 'lg:max-w-0 lg:opacity-0 lg:translate-x-[-4px]' : 'lg:max-w-40 lg:opacity-100 lg:translate-x-0'}`}>
                  <span className="block truncate font-semibold">Profile</span>
                  <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    {user?.name || user?.email || 'Account'}
                  </span>
                </div>
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg lg:group-hover:block">
                  Profile
                </span>
              </NavLink>
            </div>
          </div>
        </nav>
      </div>
  );
}
