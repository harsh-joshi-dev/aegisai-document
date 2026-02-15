import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMockAuth } from '../state/mockAuth';
import { useMockStore } from '../state/mockStore';
import { useToast } from '../state/toast';
import { ArrowRight, Building2, Users, ChevronRight } from 'lucide-react';

const ONBOARDED_KEY = 'aegis_onboarded_v1';
const WORKSPACE_NAME_KEY = 'aegis_workspace_name_v1';

type Step = 'workspace' | 'invite';

export default function OnboardingPage() {
  const { isAuthenticated, user } = useMockAuth();
  const { addUser, users } = useMockStore();
  const { push } = useToast();
  const navigate = useNavigate();

  const isOnboarded = useMemo(() => {
    try {
      return localStorage.getItem(ONBOARDED_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  const [step, setStep] = useState<Step>('workspace');
  const [workspaceName, setWorkspaceName] = useState(() => {
    try {
      return localStorage.getItem(WORKSPACE_NAME_KEY) || '';
    } catch {
      return '';
    }
  });

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Owner' | 'Admin' | 'Reviewer' | 'Viewer'>('Reviewer');

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (isOnboarded) return <Navigate to="/dashboard" replace />;

  const saveWorkspace = (e: FormEvent) => {
    e.preventDefault();
    const name = workspaceName.trim();
    if (!name) return;
    try {
      localStorage.setItem(WORKSPACE_NAME_KEY, name);
    } catch {
      // ignore
    }
    if (user?.email && !users.some((u) => u.email.toLowerCase() === user.email?.toLowerCase())) {
      addUser({
        id: `u-owner-${Date.now()}`,
        name: user.name || 'Owner',
        email: user.email,
        role: 'Owner',
      });
    }
    push({ kind: 'success', title: 'Workspace created', message: name });
    setStep('invite');
  };

  const invite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    addUser({
      id: `u-${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    push({ kind: 'success', title: 'Invite sent', message: `${inviteName.trim()} (${inviteRole})` });
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Reviewer');
  };

  const finish = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, 'true');
    } catch {
      // ignore
    }
    push({ kind: 'success', title: 'Onboarding complete', message: 'Welcome to Aegis AI.' });
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-[#030304] text-white flex flex-col items-center justify-center p-4 md:p-8 bg-noise selection:bg-indigo-500/30 font-sans">

      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-500">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 mb-6 ring-1 ring-white/10">
            <span className="font-display font-bold text-white text-xl">A</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            Set up your workspace
          </h1>
          <p className="mt-3 text-zinc-400 max-w-sm mx-auto leading-relaxed text-sm">
            Create your workspace to start analyzing documents. You can invite your team now or later.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0e0e11] rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">

          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
              style={{ width: step === 'workspace' ? '50%' : '100%' }}
            />
          </div>

          <div className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${step === 'workspace' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800/50 text-zinc-500'}`}>
                <Building2 size={24} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
                  Step {step === 'workspace' ? '1' : '2'} of 2
                </p>
                <h2 className="text-lg font-semibold text-white">
                  {step === 'workspace' ? 'Create Workspace' : 'Invite Team'}
                </h2>
              </div>
            </div>

            {step === 'workspace' ? (
              <form onSubmit={saveWorkspace} className="animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-2 block">Workspace Name</label>
                    <input
                      className="input-field h-12 text-base"
                      placeholder="e.g. Finance Team"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button className="btn-primary w-full h-12 text-base shadow-lg shadow-indigo-500/20 group">
                      Continue <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <form className="space-y-4" onSubmit={invite}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Name</label>
                      <input
                        className="input-field"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Full Name"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Email</label>
                      <input
                        className="input-field"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Role</label>
                    <div className="relative">
                      <select
                        className="input-field appearance-none cursor-pointer"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as any)}
                      >
                        <option value="Owner">Owner</option>
                        <option value="Admin">Admin</option>
                        <option value="Reviewer">Reviewer</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none rotate-90" size={16} />
                    </div>
                  </div>

                  <button className="btn-secondary w-full border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50">
                    Send Invite
                  </button>
                </form>

                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex gap-3">
                  <div className="text-indigo-400 mt-0.5">
                    <Users size={16} />
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    <span className="text-indigo-300 font-medium">Pro tip:</span> Assign reviewers to high-risk documents to keep approvals fast and auditable.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                  <button type="button" className="text-sm text-zinc-500 hover:text-white transition-colors" onClick={finish}>
                    Skip for now
                  </button>
                  <button type="button" className="btn-primary" onClick={finish}>
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
