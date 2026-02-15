import { FormEvent, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useMockAuth } from '../state/mockAuth';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

type Tab = 'login' | 'signup';

export default function AuthPage() {
  const { isAuthenticated, login, signup } = useMockAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'login') login(email, password);
    else signup(name, email, password);
  };

  return (
    <div className="min-h-screen w-full bg-[#030304] flex flex-col lg:flex-row relative overflow-hidden text-white font-sans bg-noise selection:bg-indigo-500/30">

      {/* Left Side (Marketing) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-16 border-r border-white/5 overflow-hidden">
        {/* Animated Backgrounds */}
        <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-16 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <div className="mb-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-8 ring-1 ring-white/10">
              <span className="font-display font-bold text-white text-3xl">A</span>
            </div>
            <h1 className="font-display text-5xl font-bold tracking-tight text-white leading-[1.1] mb-6">
              Decision Intelligence <br />
              <span className="text-gradient-primary">
                For Modern Finance
              </span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-lg leading-relaxed">
              Join elite finance teams automating risk detection.
              Real-time auditing, cross-document intelligence, and explainable AI.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          {[
            'SOC2 Type II Certified',
            'Bank-grade Encryption',
            '99.9% Uptime SLA'
          ].map((text) => (
            <div key={text} className="flex items-center gap-3 group">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40 transition-colors">
                <CheckCircle2 size={14} />
              </div>
              <span className="text-zinc-400 font-medium group-hover:text-zinc-200 transition-colors">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side (Auth Form) */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-[420px] animate-in slide-in-from-right-8 duration-500 fade-in">

          <div className="text-center lg:hidden mb-10">
            <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
              <span className="font-bold text-white text-2xl">A</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
          </div>

          <div className="bg-[#0e0e11] rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
            {/* Gradient Border Top */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-[#1c1c21] rounded-xl mb-8 border border-white/5">
              <button
                className={`py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${tab === 'login'
                  ? 'bg-[#27272a] text-white shadow-sm ring-1 ring-white/5'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                onClick={() => setTab('login')}
              >
                Sign In
              </button>
              <button
                className={`py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${tab === 'signup'
                  ? 'bg-[#27272a] text-white shadow-sm ring-1 ring-white/5'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                onClick={() => setTab('signup')}
              >
                Create Account
              </button>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    placeholder="John Doe"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                  {tab === 'login' && (
                    <a href="#" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button className="btn-primary w-full h-11 text-base shadow-indigo-500/25 mt-2">
                {tab === 'login' ? 'Sign In' : 'Get Started'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-zinc-500">
                By continuing, you agree to our <a href="#" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">Terms</a> and <a href="#" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
