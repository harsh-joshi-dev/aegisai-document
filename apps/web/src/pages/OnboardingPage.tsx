import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { ArrowRight, Building2, Users, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ONBOARDED_KEY = 'ca_dynamix_onboarded_v1';
const WORKSPACE_NAME_KEY = 'ca_dynamix_workspace_name_v1';
import { Logo } from '../components/ui/Logo';

type Step = 'workspace' | 'invite';

export default function OnboardingPage() {
  const { isAuthenticated, user } = useAuth();
  const { addUser, users } = useStore();
  const { push } = useToast();
  const navigate = useNavigate();

  const isOnboarded = useMemo(() => {
    try {
      const key = user?.id ? `${ONBOARDED_KEY}:${user.id}` : ONBOARDED_KEY;
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }, [user?.id]);

  const [step, setStep] = useState<Step>('workspace');
  const [workspaceName, setWorkspaceName] = useState(() => {
    try { return localStorage.getItem(WORKSPACE_NAME_KEY) || ''; } catch { return ''; }
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
    try { localStorage.setItem(WORKSPACE_NAME_KEY, name); } catch { }
    if (user?.email && !users.some((u) => u.email.toLowerCase() === user.email?.toLowerCase())) {
      addUser({ id: `u-owner-${Date.now()}`, name: user.name || 'Owner', email: user.email, role: 'Owner' });
    }
    push({ kind: 'success', title: 'Workspace Initialized', message: `Welcome to ${name}` });
    setStep('invite');
  };

  const invite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    addUser({ id: `u-${Date.now()}`, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole });
    push({ kind: 'success', title: 'Transmission Sent', message: `Invited ${inviteName.trim()} as ${inviteRole}` });
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Reviewer');
  };

  const finish = () => {
    try {
      const key = user?.id ? `${ONBOARDED_KEY}:${user.id}` : ONBOARDED_KEY;
      localStorage.setItem(key, 'true');
    } catch { }
    push({ kind: 'success', title: 'Onboarding Finalized', message: 'The platform is now ready for your commands.' });
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 sm:px-8 sm:py-16 bg-[#020617] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/[0.06] blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] bg-purple-600/[0.05] blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg z-10"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-10"
          >
            <Logo size="lg" showText={false} />
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 font-display text-white">
            Elevate Your <span className="text-indigo-400">Practice</span>
          </h1>
          <p className="text-slate-400 text-base max-w-sm mx-auto">
            Configure your secure workspace and assemble your elite team of financial experts.
          </p>
        </div>

        {/* Card */}
        <div className="glass-card relative overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 w-full bg-white/[0.04] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: step === 'workspace' ? '50%' : '100%' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            />
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {step === 'workspace' ? (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3.5 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">Step 01 / 02</p>
                      <h2 className="text-lg font-bold text-white font-display">Configure Workspace</h2>
                    </div>
                  </div>

                  <form onSubmit={saveWorkspace} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Workspace Identity</label>
                      <input
                        className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                        placeholder="e.g. Stratos Financial Group"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        required
                        autoFocus
                      />
                      <p className="text-[11px] text-slate-500 px-1">This will be the primary identifier for your intelligence repository.</p>
                    </div>

                    <button type="submit" className="btn-primary w-full h-12 text-sm uppercase tracking-widest group">
                      Continue to Deployment
                      <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="invite"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3.5 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Users size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">Step 02 / 02</p>
                      <h2 className="text-lg font-bold text-white font-display">Assemble Team</h2>
                    </div>
                  </div>

                  <form onSubmit={invite} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Full Name</label>
                        <input
                          className="w-full h-11 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="Member Name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Email Access</label>
                        <input
                          className="w-full h-11 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="email@company.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Security Clearance</label>
                      <div className="relative">
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                          className="w-full h-11 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm appearance-none cursor-pointer pr-10 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                        >
                          <option value="Owner">Owner (Full Access)</option>
                          <option value="Admin">Administrator</option>
                          <option value="Reviewer">Intelligence Reviewer</option>
                          <option value="Viewer">Read-only Analyst</option>
                        </select>
                        <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-500 pointer-events-none" />
                      </div>
                    </div>

                    <button type="submit" className="w-full h-11 rounded-xl border border-dashed border-white/[0.1] hover:border-indigo-500/40 hover:bg-indigo-500/5 text-slate-400 hover:text-indigo-400 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                      Invite Intelligence Officer
                    </button>
                  </form>

                  <div className="flex gap-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 mt-6">
                    <Sparkles size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-400 mb-0.5">Strategy Tip</p>
                      <p className="text-[12px] text-slate-400 leading-relaxed">Early reviewer integration ensures multi-layered verification and absolute data integrity.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
                    <button onClick={finish} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors cursor-pointer">
                      Skip Setup
                    </button>
                    <button onClick={finish} className="btn-primary text-xs uppercase tracking-widest">
                      Go to Dashboard
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
