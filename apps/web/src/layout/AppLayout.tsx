import { ReactNode, useMemo, useState, useCallback } from 'react';
import { Gauge, Settings, ShieldAlert, Users, ClipboardList, Menu, X, ChevronDown, LogOut, Search, Link2, IndianRupee, FileText, ScrollText } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useWorkspace } from '../state/workspace';
import { useStore } from '../state/store';
import { NotificationsDropdown } from '../ui/NotificationsDropdown';
import { Logo } from '../components/ui/Logo';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/documents', label: 'Internal Upload', icon: FileText },
  { to: '/gst-compliance', label: 'GST & Compliance', icon: IndianRupee },
  { to: '/vendor-links', label: 'Vendor Portal', icon: Link2 },
  { to: '/rules', label: 'Rules', icon: ShieldAlert },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspaceId, role } = useWorkspace();
  const { documents } = useStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return documents
      .filter(d => d.name.toLowerCase().includes(q) || d.vendor.toLowerCase().includes(q) || d.id.includes(q))
      .slice(0, 8);
  }, [searchQuery, documents]);

  const handleSearchSelect = useCallback((docId: string) => {
    setSearchQuery('');
    setSearchOpen(false);
    navigate(`/document/${docId}`);
  }, [navigate]);

  const userRole = useMemo(() => {
    if (!role) return null;
    const r = String(role);
    return r.length ? r.charAt(0).toUpperCase() + r.slice(1) : null;
  }, [role]);

  const handleWorkspaceChange = (id: string) => {
    const target = workspaces.find((w) => w.id === id);
    if (!target || target.id === activeWorkspace.id) return;
    setWorkspaceOpen(false);
    setConfirmSwitch({ id, name: target.name });
  };

  const confirmWorkspaceSwitch = () => {
    if (confirmSwitch) {
      setActiveWorkspaceId(confirmSwitch.id as any);
      setConfirmSwitch(null);
      window.location.href = '/dashboard';
    }
  };

  const initials = useMemo(() => {
    const n = user?.name?.trim();
    if (!n) return 'U';
    return n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
  }, [user?.name]);

  const pageTitle = useMemo(() => {
    const item = navItems.find(i => i.to === location.pathname);
    return item ? item.label : 'Dashboard';
  }, [location.pathname]);

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="h-full w-72 border-r border-white/5 bg-[var(--bg-sidebar)]/80 backdrop-blur-xl flex flex-col relative z-20 shadow-2xl transition-colors duration-300">
      {/* Sidebar Header */}
      <div className="px-6 py-8 flex items-center justify-between">
        <Logo size="sm" />
        {onNavigate && (
          <button
            className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-white/5 lg:hidden"
            onClick={onNavigate}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      <div className="px-4 mb-6">
        <div className="relative group">
          <button
            type="button"
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-white/10 hover:bg-white/[0.06] transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{activeWorkspace.name}</span>
              {userRole && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                  {userRole}
                </span>
              )}
            </div>
            <ChevronDown size={14} className={`shrink-0 ml-2 text-zinc-500 transition-transform ${workspaceOpen ? 'rotate-180' : ''}`} />
          </button>
          {workspaceOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#0e0e11] shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleWorkspaceChange(w.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${w.id === activeWorkspace.id
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <span className="truncate">{w.name}</span>
                  {userRole && w.id === activeWorkspace.id && (
                    <span className="text-[10px] text-indigo-400">{userRole}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden ${isActive
                ? 'bg-indigo-500/10 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.1)] ring-1 ring-indigo-500/20'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-full w-[3px] bg-indigo-500 shadow-[0_0_8px_#6366f1] rounded-r-full" />
                )}
                <item.icon size={18} className={isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 mt-auto space-y-4">
        {/* Status Card */}
        <div className="rounded-xl border border-indigo-500/10 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
            <ShieldAlert size={48} />
          </div>
          <div className="flex items-center gap-2 mb-2 text-indigo-400">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 animate-ping rounded-full opacity-25"></div>
              <div className="relative w-2 h-2 bg-indigo-400 rounded-full"></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider">System Active</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            Risk engine is monitoring <span className="text-zinc-300 font-semibold">real-time</span>.
          </p>
        </div>

        {/* User Profile */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group relative">
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 text-xs font-bold text-zinc-300 group-hover:border-indigo-500/50 group-hover:text-white transition-all shadow-sm ring-2 ring-transparent group-hover:ring-indigo-500/20">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{user?.name}</p>
              <p className="text-xs text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 absolute right-2 bg-[#0e0e11]"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div >
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex overflow-hidden font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-noise opacity-[0.03]" />

      {/* Global Glows */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-900/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block h-screen sticky top-0 border-r border-white/5 z-30">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-in slide-in-from-left duration-300 w-72">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen relative z-10 transition-all duration-300">

        {/* Top Header (Mobile & Desktop) */}
        <header className="sticky top-0 z-[45] bg-[var(--bg-main)]/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 transition-all duration-300">
          <div className="flex items-center gap-3 lg:hidden">
            <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
              <Menu size={20} />
            </button>
            <Logo size="sm" showText={false} />
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <h2 className="font-display text-lg font-semibold text-white tracking-tight">{pageTitle}</h2>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
              <span className="text-sm font-medium text-zinc-300">{activeWorkspace.name}</span>
              {userRole && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{userRole}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block relative">
              <div className="flex items-center bg-white/5 border border-white/5 rounded-full px-3 py-1.5 w-72 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all group">
                <Search size={14} className="text-zinc-500 group-focus-within:text-indigo-400" />
                <input
                  className="bg-transparent border-none outline-none text-sm text-white px-2 w-full placeholder-zinc-600"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); }
                    if (e.key === 'Enter' && searchResults.length > 0) handleSearchSelect(searchResults[0].id);
                  }}
                />
                {!searchQuery && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-600 font-mono border border-zinc-700 rounded px-1">⌘K</span>
                  </div>
                )}
              </div>
              {searchOpen && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0e0e11] shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-zinc-500">No documents match "{searchQuery}"</div>
                  ) : searchResults.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onMouseDown={() => handleSearchSelect(doc.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <FileText size={16} className="text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{doc.vendor} · {doc.riskLevel}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${doc.riskLevel === 'Critical' ? 'bg-red-500/20 text-red-400' :
                          c.riskLevel === 'High' ? 'bg-orange-500/20 text-orange-400' :
                            'bemerald-500/20 text-emerald-400'
                        }`}>{doc.riskLevel}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <NotificationsDropdown />
          </div>
        </header>

        <main className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden p-6 lg:p-10" key={activeWorkspace.id}>
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>

      {/* Workspace switch confirmation */}
      {confirmSwitch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0e11] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">Switch workspace?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Switch to <span className="text-white font-medium">{confirmSwitch.name}</span>? Dashboard, documents, and users will refresh.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSwitch(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmWorkspaceSwitch}
                className="btn-primary flex-1"
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
