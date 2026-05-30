import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
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
      <Routes>
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
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

  return (
      <div className="min-h-screen bg-surface-50 lg:flex">
        {/* Main content */}
        <main className="flex-1 w-full max-w-6xl mx-auto pb-24 lg:pb-8 lg:pl-32 px-4 sm:px-6 lg:px-8">
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
        <nav className="fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-xl border-t border-surface-200 z-50 lg:top-0 lg:right-auto lg:w-24 lg:border-t-0 lg:border-r">
          <div className="mx-auto flex max-w-full justify-start gap-1 overflow-x-auto px-2 py-2 lg:max-w-none lg:h-full lg:flex-col lg:justify-start lg:gap-2 lg:overflow-visible lg:px-3 lg:py-8">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-xs font-medium lg:px-2 lg:py-3 ${
                    isActive
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
  );
}
