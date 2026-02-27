import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Building2,
  FolderKanban,
  Plus,
  ChevronsUpDown,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import NotificationsDropdown from './NotificationsDropdown';
import { useWorkspaceStore } from '../stores/workspace';
import { getOrganizations, getProjects, createProjectApi } from '../stores/api';

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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  
  const {
    currentOrg,
    currentProject,
    organizations,
    projects,
    setCurrentOrg,
    setCurrentProject,
    setOrganizations,
    setProjects,
  } = useWorkspaceStore();

  // Load organizations on mount + onboarding guard
  useEffect(() => {
    loadOrganizations();
  }, []);

  // Load projects when org changes
  useEffect(() => {
    if (currentOrg) {
      loadProjects(currentOrg.id);
    }
  }, [currentOrg?.id]);

  async function loadOrganizations() {
    try {
      const res = await getOrganizations();
      if (res.success) {
        setOrganizations(res.data);
        
        // Onboarding guard: if user has no organizations, redirect to onboarding
        if (res.data.length === 0) {
          navigate('/onboarding', { replace: true });
          return;
        }

        // Auto-select first org if none selected
        if (!currentOrg && res.data.length > 0) {
          setCurrentOrg(res.data[0]);
        }
      }
    } catch {
      // Silent fail
    } finally {
      setOnboardingChecked(true);
    }
  }

  async function loadProjects(orgId: string) {
    try {
      const res = await getProjects(orgId);
      if (res.success) {
        setProjects(res.data);
      }
    } catch {
      setProjects([]);
    }
  }

  function handleOrgChange(orgId: string) {
    const org = organizations.find((o) => o.id === orgId) || null;
    setCurrentOrg(org);
  }

  function handleProjectChange(projectId: string) {
    const project = projects.find((p) => p.id === projectId) || null;
    setCurrentProject(project);
  }

  // Don't render until onboarding check is done
  if (!onboardingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="w-8 h-8 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
              src="/keelo-logo.svg" 
              alt="Keelo" 
              className="w-8 h-8 rounded-lg"
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

        {/* Footer */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center justify-center gap-2 text-xs text-dark-500">
            <img 
              src="/keelo-icon.svg" 
              alt="Keelo" 
              className="w-4 h-4"
            />
            <span className="text-dark-400">Keelo v1.0</span>
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

          {/* Workspace Selector */}
          <div className="flex items-center gap-3 ml-2">
            {/* Organization Selector */}
            <WorkspaceDropdown
              icon={<Building2 size={16} className="text-dark-400" />}
              items={organizations.map((o) => ({ id: o.id, label: o.name }))}
              selectedId={currentOrg?.id || ''}
              onChange={handleOrgChange}
              onCreateNew={() => navigate('/onboarding')}
              createLabel="Nova organização"
              placeholder="Selecione org"
            />

            {/* Project Selector */}
            {currentOrg && (
              <>
                <span className="text-dark-600">/</span>
                <WorkspaceDropdown
                  icon={<FolderKanban size={16} className="text-dark-400" />}
                  items={projects.map((p) => ({ id: p.id, label: p.name }))}
                  selectedId={currentProject?.id || ''}
                  onChange={handleProjectChange}
                  onCreateNew={async () => {
                    const name = prompt('Nome do projeto:');
                    if (!name) return;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    try {
                      const res = await createProjectApi(currentOrg.id, { name, slug });
                      if (res.success && res.data) {
                        await loadProjects(currentOrg.id);
                        setCurrentProject(res.data as any);
                      }
                    } catch { /* silent */ }
                  }}
                  createLabel="Novo projeto"
                  placeholder="Todos os projetos"
                  allowAll
                />
              </>
            )}
          </div>

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

// =============================================================================
// Workspace Dropdown Component
// =============================================================================

interface DropdownItem {
  id: string;
  label: string;
}

interface WorkspaceDropdownProps {
  icon: React.ReactNode;
  items: DropdownItem[];
  selectedId: string;
  onChange: (id: string) => void;
  onCreateNew?: () => void;
  createLabel?: string;
  placeholder?: string;
  allowAll?: boolean;
}

function WorkspaceDropdown({
  icon,
  items,
  selectedId,
  onChange,
  onCreateNew,
  createLabel = 'Criar novo',
  placeholder = 'Selecione',
  allowAll = false,
}: WorkspaceDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedId);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg hover:border-dark-600 transition-colors max-w-[200px]"
      >
        {icon}
        <span className="text-sm text-dark-100 truncate">
          {selectedItem?.label || placeholder}
        </span>
        <ChevronsUpDown size={14} className="text-dark-500 flex-shrink-0" />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-1 w-56 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden"
        >
          {allowAll && (
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-dark-700 transition-colors ${
                !selectedId ? 'text-keelo-400 bg-keelo-500/10' : 'text-dark-300'
              }`}
            >
              {placeholder}
            </button>
          )}

          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => { onChange(item.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-dark-700 transition-colors ${
                item.id === selectedId ? 'text-keelo-400 bg-keelo-500/10' : 'text-dark-200'
              }`}
            >
              {item.label}
            </button>
          ))}

          {onCreateNew && (
            <>
              <div className="border-t border-dark-700 my-1" />
              <button
                onClick={() => { onCreateNew(); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-keelo-400 hover:bg-dark-700 transition-colors flex items-center gap-2"
              >
                <Plus size={14} />
                {createLabel}
              </button>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
