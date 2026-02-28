import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useStore } from '../state/store';
import { useWorkspace } from '../state/workspace';
import { useToast } from '../state/toast';
import { useTheme } from '../state/theme';
import {
  Settings, Clock, Zap, Users, Save, ShieldCheck, RotateCcw,
  User, Bell, Palette, Shield, Key, Moon, Sun,
  ChevronRight, AlertTriangle, Check, Building2,
  Eye, EyeOff, Database,
} from 'lucide-react';

const AEGIS_KEYS = [
  'aegis_mock_store_v1',
  'aegis_mock_user',
  'aegis_onboarded_v1',
  'aegis_workspace_name_v1',
  'aegis_active_workspace',
  'aegis_active_tenant_v1',
  'auth_token',
];

function resetAllData() {
  for (const k of AEGIS_KEYS) localStorage.removeItem(k);
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('aegis_onboarded_v1:')) toDelete.push(k);
      if (k.startsWith('aegis_auth_token_exchanged_v1:')) toDelete.push(k);
      if (k.startsWith('aegis_auth_token_exchange_state_v1:')) toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  window.location.href = '/';
}

type Tab = 'general' | 'workflow' | 'notifications' | 'appearance' | 'security' | 'danger';

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'workflow', label: 'Workflow & SLA', icon: Zap },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      style={{ background: checked ? '#6366f1' : 'rgba(255,255,255,0.08)' }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 shadow-sm"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, color = 'indigo' }: {
  icon: typeof Settings; title: string; description: string; color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'rgba(99,102,241,0.10)',
    amber: 'rgba(245,158,11,0.10)',
    emerald: 'rgba(16,185,129,0.10)',
    rose: 'rgba(239,68,68,0.10)',
    sky: 'rgba(14,165,233,0.10)',
    violet: 'rgba(139,92,246,0.10)',
  };
  const textColors: Record<string, string> = {
    indigo: '#818cf8',
    amber: '#fbbf24',
    emerald: '#34d399',
    rose: '#fb7185',
    sky: '#38bdf8',
    violet: '#a78bfa',
  };
  return (
    <div className="flex items-center gap-3.5 mb-6">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: colors[color], color: textColors[color] }}
      >
        <Icon size={19} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-main font-display">{title}</h3>
        <p className="text-xs text-dim mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-main">{label}</p>
        {description && <p className="text-xs text-dim mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { users, settingsByTenant, upsertWorkspaceSettings, auditLog } = useStore();
  const { push } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('general');

  const actorRole = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return users.find((u) => u.email.toLowerCase() === email)?.role ?? null;
  }, [user?.email, users]);

  const canAccess = actorRole === 'Owner' || actorRole === 'Admin';
  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const tenantId = activeWorkspace.id;
  const current = settingsByTenant[tenantId] ?? {
    tenant_id: tenantId,
    assignmentStrategy: 'least_loaded' as const,
    slaHours: 24,
    escalationHours: 48,
  };

  const reviewerUsers = useMemo(() => users.filter((u) => u.role === 'Reviewer'), [users]);

  const [assignmentStrategy, setAssignmentStrategy] = useState(current.assignmentStrategy);
  const [defaultReviewerId, setDefaultReviewerId] = useState(current.defaultReviewerId || '');
  const [slaHours, setSlaHours] = useState(current.slaHours);
  const [escalationHours, setEscalationHours] = useState(current.escalationHours);

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [slaReminders, setSlaReminders] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const settings = {
      tenant_id: tenantId,
      assignmentStrategy,
      defaultReviewerId: assignmentStrategy === 'default' ? (defaultReviewerId || undefined) : undefined,
      slaHours: Number(slaHours) || 24,
      escalationHours: Number(escalationHours) || 48,
    };
    upsertWorkspaceSettings(settings);
    auditLog({
      tenant_id: tenantId,
      action: 'workspace_settings_updated',
      performed_by: user?.email,
      metadata: settings,
    });
    push({ kind: 'success', title: 'Settings saved', message: 'Your workspace configuration has been updated.' });
  };

  const strategyOptions = [
    { value: 'first', label: 'First Available', description: 'Assign to the first available reviewer', icon: Zap },
    { value: 'round_robin', label: 'Round Robin', description: 'Distribute evenly across all reviewers', icon: Users },
    { value: 'least_loaded', label: 'Least Loaded', description: 'Assign to reviewer with fewest open items', icon: ShieldCheck },
    { value: 'default', label: 'Default Reviewer', description: 'Always assign to a specific reviewer', icon: User },
  ];

  const initials = useMemo(() => {
    const n = user?.name?.trim();
    if (!n) return 'U';
    return n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
  }, [user?.name]);

  return (
    <div className="pb-12">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-dim mb-3">
          <Settings size={12} />
          <span>Settings</span>
          <ChevronRight size={10} />
          <span className="text-muted">{TABS.find((t) => t.id === activeTab)?.label}</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-main tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-dim">
          Manage workspace configuration, preferences, and security for <span className="text-muted font-medium">{activeWorkspace.name}</span>.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <nav className="lg:w-56 shrink-0">
          <div className="lg:sticky lg:top-24 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDanger = tab.id === 'danger';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer
                    ${isActive
                      ? isDanger
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-indigo-500/10 text-indigo-400'
                      : isDanger
                        ? 'text-dim hover:text-rose-400 hover:bg-rose-500/5'
                        : 'text-dim hover:text-main hover:bg-subtle'
                    }
                  `}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* ───── General ───── */}
          {activeTab === 'general' && (
            <>
              {/* Profile Card */}
              <SectionCard>
                <SectionHeader icon={User} title="Profile" description="Your account information" />
                <div className="flex items-center gap-5 p-4 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: 'white',
                      boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-main font-display truncate">{user?.name}</p>
                    <p className="text-sm text-dim truncate">{user?.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide"
                        style={{ background: 'rgba(99,102,241,0.10)', color: '#818cf8' }}
                      >
                        <ShieldCheck size={11} />
                        {actorRole}
                      </span>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Workspace Info */}
              <SectionCard>
                <SectionHeader icon={Building2} title="Workspace" description="Current workspace configuration" />
                <div className="space-y-0">
                  <SettingRow label="Workspace Name" description="The name displayed across the platform">
                    <span className="text-sm text-muted font-medium">{activeWorkspace.name}</span>
                  </SettingRow>
                  <SettingRow label="Workspace ID" description="Unique identifier for API integrations">
                    <code className="text-xs text-dim font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
                      {activeWorkspace.id.slice(0, 12)}...
                    </code>
                  </SettingRow>
                  <SettingRow label="Team Members" description="Active users in this workspace">
                    <span className="text-sm text-muted font-medium">{users.length} members</span>
                  </SettingRow>
                  <div className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-sm font-medium text-main">Default Language</p>
                      <p className="text-xs text-dim mt-0.5">Language for AI document processing</p>
                    </div>
                    <select
                      className="text-sm font-medium text-muted px-3 py-1.5 rounded-lg cursor-pointer appearance-none"
                      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      defaultValue="en"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="multi">Multilingual</option>
                    </select>
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {/* ───── Workflow & SLA ───── */}
          {activeTab === 'workflow' && (
            <form onSubmit={save} className="space-y-6">
              <SectionCard>
                <SectionHeader icon={Zap} title="Assignment Strategy" description="How new documents get assigned to reviewers" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {strategyOptions.map((opt) => {
                    const isSelected = assignmentStrategy === opt.value;
                    const Icon = opt.icon;
                    return (
                      <label
                        key={opt.value}
                        className={`
                          relative flex items-start gap-3.5 p-4 rounded-xl cursor-pointer transition-all duration-200 group
                          ${isSelected
                            ? 'ring-1 ring-indigo-500/30'
                            : 'hover:border-[var(--border-light)]'
                          }
                        `}
                        style={{
                          background: isSelected ? 'rgba(99,102,241,0.06)' : 'var(--bg-subtle)',
                          border: isSelected ? '1px solid rgba(99,102,241,0.20)' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <input type="radio" name="strategy" value={opt.value} checked={isSelected} onChange={() => setAssignmentStrategy(opt.value as typeof assignmentStrategy)} className="hidden" />
                        <div
                          className="p-2 rounded-lg shrink-0 transition-colors"
                          style={{
                            background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                            color: isSelected ? '#818cf8' : 'var(--text-dim)',
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-main">{opt.label}</p>
                          <p className="text-xs text-dim mt-0.5">{opt.description}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                            <Check size={12} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>

                {assignmentStrategy === 'default' && (
                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-medium text-dim uppercase tracking-wide">Default Reviewer</label>
                    <div className="relative">
                      <select
                        className="input-field appearance-none cursor-pointer"
                        value={defaultReviewerId}
                        onChange={(e) => setDefaultReviewerId(e.target.value)}
                      >
                        <option value="">Select a reviewer...</option>
                        {reviewerUsers.map((r) => (
                          <option key={r.id} value={r.email}>{r.name} ({r.email})</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dim">
                        <ChevronRight size={12} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard>
                <SectionHeader icon={Clock} title="SLA & Escalation" description="Define time limits for reviews and automatic escalations" color="amber" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-dim uppercase tracking-wide">SLA Deadline</label>
                    <div className="relative">
                      <input
                        className="input-field pr-16"
                        type="number"
                        min={1}
                        value={slaHours}
                        onChange={(e) => setSlaHours(Number(e.target.value))}
                        placeholder="24"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim font-medium">hours</span>
                    </div>
                    <p className="mt-2 text-xs text-dim">Documents not reviewed within this time are flagged as overdue.</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-dim uppercase tracking-wide">Auto-Escalation</label>
                    <div className="relative">
                      <input
                        className="input-field pr-16"
                        type="number"
                        min={1}
                        value={escalationHours}
                        onChange={(e) => setEscalationHours(Number(e.target.value))}
                        placeholder="48"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim font-medium">hours</span>
                    </div>
                    <p className="mt-2 text-xs text-dim">Documents escalated to admin after this period if unresolved.</p>
                  </div>
                </div>
              </SectionCard>

              <div className="flex justify-end">
                <button type="submit" className="btn-primary h-11 px-8">
                  <Save size={16} className="mr-2" />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ───── Notifications ───── */}
          {activeTab === 'notifications' && (
            <SectionCard>
              <SectionHeader icon={Bell} title="Notification Preferences" description="Control how you receive updates and alerts" color="sky" />
              <div className="space-y-0">
                <SettingRow label="Email Notifications" description="Receive email alerts for document assignments and status changes">
                  <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
                </SettingRow>
                <SettingRow label="Risk Alerts" description="Get notified when high or critical risk documents are detected">
                  <Toggle checked={riskAlerts} onChange={setRiskAlerts} />
                </SettingRow>
                <SettingRow label="SLA Reminders" description="Remind reviewers before SLA deadlines expire">
                  <Toggle checked={slaReminders} onChange={setSlaReminders} />
                </SettingRow>
                <SettingRow label="Weekly Digest" description="Summary of workspace activity sent every Monday">
                  <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
                </SettingRow>
                <div className="flex items-center justify-between gap-4 pt-4">
                  <div>
                    <p className="text-sm font-medium text-main">Notification Channel</p>
                    <p className="text-xs text-dim mt-0.5">Where alerts are delivered</p>
                  </div>
                  <select
                    className="text-sm font-medium text-muted px-3 py-1.5 rounded-lg cursor-pointer appearance-none"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                    defaultValue="email"
                  >
                    <option value="email">Email Only</option>
                    <option value="in_app">In-App Only</option>
                    <option value="both">Email + In-App</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ───── Appearance ───── */}
          {activeTab === 'appearance' && (
            <SectionCard>
              <SectionHeader icon={Palette} title="Appearance" description="Customize the look and feel of your workspace" color="violet" />
              <div className="space-y-0">
                <SettingRow label="Theme" description="Switch between dark and light mode">
                  <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                    {[
                      { value: 'dark' as const, icon: Moon, label: 'Dark' },
                      { value: 'light' as const, icon: Sun, label: 'Light' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { if (theme !== opt.value) toggleTheme(); }}
                        className={`
                          flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                          ${theme === opt.value ? 'text-main shadow-sm' : 'text-dim hover:text-muted'}
                        `}
                        style={theme === opt.value ? { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' } : { border: '1px solid transparent' }}
                      >
                        <opt.icon size={13} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="Compact Mode" description="Reduce spacing for denser information display">
                  <Toggle checked={false} onChange={() => push({ kind: 'info', title: 'Coming soon', message: 'Compact mode will be available in the next update.' })} />
                </SettingRow>
                <div className="flex items-center justify-between gap-4 pt-4">
                  <div>
                    <p className="text-sm font-medium text-main">Sidebar Position</p>
                    <p className="text-xs text-dim mt-0.5">Choose left or right sidebar layout</p>
                  </div>
                  <select
                    className="text-sm font-medium text-muted px-3 py-1.5 rounded-lg cursor-pointer appearance-none"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                    defaultValue="left"
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ───── Security ───── */}
          {activeTab === 'security' && (
            <>
              <SectionCard>
                <SectionHeader icon={Shield} title="Security & Access" description="Manage authentication and access controls" color="emerald" />
                <div className="space-y-0">
                  <SettingRow label="Two-Factor Authentication" description="Add an extra layer of security to your account">
                    <button
                      type="button"
                      className="text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)' }}
                      onClick={() => push({ kind: 'info', title: 'Coming soon', message: '2FA will be available in the next release.' })}
                    >
                      Enable 2FA
                    </button>
                  </SettingRow>
                  <SettingRow label="Session Timeout" description="Automatically log out after a period of inactivity">
                    <select
                      className="text-sm font-medium text-muted px-3 py-1.5 rounded-lg cursor-pointer appearance-none"
                      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      defaultValue="24h"
                    >
                      <option value="1h">1 hour</option>
                      <option value="8h">8 hours</option>
                      <option value="24h">24 hours</option>
                      <option value="7d">7 days</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="IP Whitelisting" description="Restrict access to specific IP addresses">
                    <Toggle checked={false} onChange={() => push({ kind: 'info', title: 'Enterprise feature', message: 'IP whitelisting is available on Enterprise plans.' })} />
                  </SettingRow>
                </div>
              </SectionCard>

              <SectionCard>
                <SectionHeader icon={Key} title="API Access" description="Manage API keys for integrations" />
                <div className="p-4 rounded-xl flex items-center justify-between gap-4" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="min-w-0">
                    <p className="text-xs text-dim uppercase tracking-wide font-medium mb-1.5">API Key</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-muted font-mono truncate">
                        {showApiKey ? `cdx_live_${activeWorkspace.id.slice(0, 20)}` : 'cdx_live_••••••••••••••••••••'}
                      </code>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-dim hover:text-muted transition-colors cursor-pointer p-1"
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs px-4"
                    onClick={() => push({ kind: 'success', title: 'Copied', message: 'API key copied to clipboard.' })}
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.10)' }}>
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400/80 leading-relaxed">
                    Keep your API key secret. Never share it in client-side code or public repositories.
                  </p>
                </div>
              </SectionCard>
            </>
          )}

          {/* ───── Danger Zone ───── */}
          {activeTab === 'danger' && (
            <SectionCard className="!border-rose-500/15">
              <SectionHeader icon={AlertTriangle} title="Danger Zone" description="Irreversible actions that affect your entire workspace" color="rose" />
              <div className="space-y-4">
                <div className="p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.10)' }}>
                  <div>
                    <p className="text-sm font-semibold text-main">Reset All Data</p>
                    <p className="text-xs text-dim mt-0.5">Clear all documents, users, rules, and auth. Returns to landing page.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.confirm('Are you sure? This will clear ALL data and return you to the landing page. This action cannot be undone.') && resetAllData()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all shrink-0"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      color: '#fb7185',
                      border: '1px solid rgba(239,68,68,0.20)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  >
                    <RotateCcw size={14} />
                    Reset & Start Fresh
                  </button>
                </div>

                <div className="p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.10)' }}>
                  <div>
                    <p className="text-sm font-semibold text-main">Delete Workspace</p>
                    <p className="text-xs text-dim mt-0.5">Permanently delete this workspace and all associated data.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => push({ kind: 'error', title: 'Not available', message: 'Workspace deletion requires contacting support.' })}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all shrink-0"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      color: '#fb7185',
                      border: '1px solid rgba(239,68,68,0.20)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  >
                    <Database size={14} />
                    Delete Workspace
                  </button>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
