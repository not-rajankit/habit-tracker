import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import WeeklySummary from './pages/WeeklySummary';
import MonthlySummary from './pages/MonthlySummary';
import Goals from './pages/Goals';
import HabitTable from './pages/HabitTable';

const navItems = [
  { to: '/', label: 'Today', icon: '☀️' },
  { to: '/table', label: 'Table', icon: '▦' },
  { to: '/weekly', label: 'Week', icon: '📊' },
  { to: '/monthly', label: 'Month', icon: '📅' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-50 flex flex-col">
        {/* Main content */}
        <main className="flex-1 max-w-lg mx-auto w-full pb-24 px-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/table" element={<HabitTable />} />
            <Route path="/weekly" element={<WeeklySummary />} />
            <Route path="/monthly" element={<MonthlySummary />} />
            <Route path="/goals" element={<Goals />} />
          </Routes>
        </main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-surface-200 z-50">
          <div className="max-w-lg mx-auto flex justify-around py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all text-xs font-medium ${
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
    </BrowserRouter>
  );
}
