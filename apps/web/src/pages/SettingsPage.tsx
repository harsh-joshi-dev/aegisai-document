import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMockAuth } from '../state/mockAuth';
import { useMockStore } from '../state/mockStore';
import { useWorkspace } from '../state/workspace';
import { useToast } from '../state/toast';
import { Settings, Clock, Zap, Users, Save, ShieldCheck, RotateCcw } from 'lucide-react';

const AEGIS_KEYS = [
  'aegis_mock_store_v1',
  'aegis_mock_user',
  'aegis_onboarded_v1',
  'aegis_workspace_name_v1',
  'aegis_active_workspace',
];

function resetAllData() {
  for (const k of AEGIS_KEYS) localStorage.removeItem(k);
  window.location.href = '/';
}

export default function SettingsPage() {
  const { user } = useMockAuth();
  const { activeWorkspace } = useWorkspace();
  const { users, settingsByTenant, upsertWorkspaceSettings, auditLog } = useMockStore();
  const { push } = useToast();

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
    { value: 'default', label: 'Default Reviewer', description: 'Always assign to a specific reviewer', icon: Users },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">
            Configure assignment strategies, SLA policies, and escalation rules for <span className="text-white font-medium">{activeWorkspace.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/5">
          <Settings size={14} /> Admin Only
        </div>
      </div>

      <form onSubmit={save} className="space-y-8">
        {/* Assignment Strategy */}
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Assignment Strategy</h2>
              <p className="text-xs text-zinc-500">How new documents get assigned to reviewers</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {strategyOptions.map((opt) => {
              const isSelected = assignmentStrategy === opt.value;
              const Icon = opt.icon;
              return (
                <label
                  key={opt.value}
                  className={`
                    relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all group
                    ${isSelected
                      ? 'bg-indigo-500/5 border-indigo-500/30 ring-1 ring-indigo-500/20'
                      : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => setAssignmentStrategy(opt.value as typeof assignmentStrategy)}
                    className="hidden"
                  />
                  <div className={`p-2 rounded-lg shrink-0 transition-colors ${isSelected ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-zinc-500 group-hover:text-zinc-300'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium transition-colors ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{opt.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{opt.description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  )}
                </label>
              );
            })}
          </div>

          {assignmentStrategy === 'default' && (
            <div className="mt-5 animate-in fade-in slide-in-from-bottom-2">
              <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Default Reviewer</label>
              <div className="relative">
                <select
                  className="input-field appearance-none cursor-pointer"
                  value={defaultReviewerId}
                  onChange={(e) => setDefaultReviewerId(e.target.value)}
                >
                  <option value="">Select a reviewer…</option>
                  {reviewerUsers.map((r) => (
                    <option key={r.id} value={r.email}>{r.name} ({r.email})</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SLA & Escalation */}
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">SLA & Escalation</h2>
              <p className="text-xs text-zinc-500">Define time limits for reviews and automatic escalations</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">SLA Deadline (hours)</label>
              <input
                className="input-field"
                type="number"
                min={1}
                value={slaHours}
                onChange={(e) => setSlaHours(Number(e.target.value))}
                placeholder="24"
              />
              <p className="mt-2 text-xs text-zinc-600">Documents not reviewed within this time are flagged as overdue.</p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Auto-Escalation (hours)</label>
              <input
                className="input-field"
                type="number"
                min={1}
                value={escalationHours}
                onChange={(e) => setEscalationHours(Number(e.target.value))}
                placeholder="48"
              />
              <p className="mt-2 text-xs text-zinc-600">Documents escalated to admin after this period if unresolved.</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary h-11 px-8 shadow-lg shadow-indigo-500/20">
            <Save size={16} className="mr-2" />
            Save Changes
          </button>
        </div>
      </form>

      {/* Reset data (for testing) */}
      <div className="card-premium p-6 border-amber-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <RotateCcw size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Reset All Data</h2>
            <p className="text-xs text-zinc-500">Clear documents, users, rules, and auth. Use for clean testing.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.confirm('Clear all data and return to landing?') && resetAllData()}
          className="btn-secondary border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
        >
          <RotateCcw size={16} className="mr-2" />
          Reset &amp; Start Fresh
        </button>
      </div>
    </div>
  );
}
