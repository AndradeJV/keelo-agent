import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileSearch,
  FileText,
  Flame,
  Heart,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import NotificationsDropdown from './NotificationsDropdown';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/analyses', icon: FileSearch, label: 'Análises' },
  { path: '/requirements', icon: FileText, label: 'Requisitos' },
  { path: '/hotspots', icon: Flame, label: 'Hot Spots' },
  { path: '/qa-health', icon: Heart, label: 'Saúde de QA' },
  { path: '/product-insights', icon: Briefcase, label: 'Produto' },
  { path: '/settings', icon: Settings, label: 'Configurações' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <img 
              src="/trace-logo.jpeg" 
              alt="Trace Finance" 
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="text-xl font-semibold gradient-text">Keelo</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-dark-400 hover:text-dark-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-keelo-500/10 text-keelo-400 border border-keelo-500/30'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-keelo-500 to-keelo-600 flex items-center justify-center">
              <span className="text-white font-medium">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-100 truncate">{user?.name}</p>
              <p className="text-xs text-dark-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-dark-400 hover:text-red-400 transition-colors"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Footer - Powered by */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center justify-center gap-2 text-xs text-dark-500">
            <span>Powered by</span>
            <img 
              src="/trace-logo.jpeg" 
              alt="Trace Finance" 
              className="w-4 h-4 rounded object-cover"
            />
            <span className="text-dark-400">Trace Finance</span>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-dark-900/80 backdrop-blur-sm border-b border-dark-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-dark-400 hover:text-dark-200"
          >
            <Menu size={24} />
          </button>

          <div className="flex-1" />

          {/* Notifications */}
          <NotificationsDropdown />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

