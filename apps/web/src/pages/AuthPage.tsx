import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../state/auth';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Zap,
  BarChart3,
  FileSearch,
  Brain,
  CheckCircle2,
  Fingerprint,
  Globe,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Logo } from '../components/ui/Logo';

const TESTIMONIALS = [
  {
    quote: 'CA.Dynamix cut our audit turnaround by 60%. The AI catches things we used to miss entirely.',
    name: 'Rajesh Mehta',
    role: 'Senior Partner, Mehta & Associates',
  },
  {
    quote: 'Finally a platform built for CAs. The risk scoring alone saved us from two fraudulent vendor claims.',
    name: 'Priya Sharma',
    role: 'Managing Director, Finova Advisory',
  },
  {
    quote: 'Our compliance workflow went from 3 days to 3 hours. The document intelligence is remarkable.',
    name: 'Arjun Desai',
    role: 'Founder, Desai Financial Services',
  },
];

const FEATURES = [
  { icon: Brain, label: 'AI Document Intelligence', desc: 'Auto-classify and extract data from 50+ document types' },
  { icon: ShieldCheck, label: 'Compliance Engine', desc: 'Real-time DPDP, GDPR & SOC2-II enforcement' },
  { icon: BarChart3, label: 'Risk Analytics', desc: 'ML-powered risk scoring with pattern detection' },
  { icon: FileSearch, label: 'Smart Extraction', desc: 'OCR + NLP pipeline for financial data extraction' },
];

const STATS = [
  { value: '50K+', label: 'Documents Processed' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '2.1s', label: 'Avg. Processing' },
  { value: '500+', label: 'CA Firms' },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function RotatingTestimonials() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const t = TESTIMONIALS[idx];
  return (
    <div className="relative min-h-[120px]">
      <motion.div
        key={idx}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-[15px] leading-relaxed text-white/70 italic">"{t.quote}"</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {t.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">{t.name}</p>
            <p className="text-xs text-white/40">{t.role}</p>
          </div>
        </div>
      </motion.div>
      <div className="flex gap-1.5 mt-5">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="h-1 rounded-full transition-all duration-500 cursor-pointer"
            style={{
              width: i === idx ? 24 : 8,
              background: i === idx ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { isAuthenticated, login } = useAuth();
  const [hovering, setHovering] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="fixed inset-0 flex" style={{ background: '#030712' }}>
      {/* ─── LEFT PANEL: Brand Showcase ─── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12 xl:p-16">
        {/* Gradient mesh background */}
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(79,70,229,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 60%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='1' cy='1' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          {/* Animated orb */}
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
              top: '10%',
              left: '30%',
            }}
            animate={{ x: [0, 30, -20, 0], y: [0, -20, 30, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
              bottom: '5%',
              right: '10%',
            }}
            animate={{ x: [0, -25, 15, 0], y: [0, 20, -25, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Top: Logo & brand */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Logo size="sm" />
          </Link>
        </motion.div>

        {/* Middle: Features + Stats */}
        <motion.div
          className="relative z-10 flex-1 flex flex-col justify-center max-w-xl"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.h2
            variants={fadeUp}
            className="text-[2.75rem] xl:text-[3.25rem] font-extrabold text-white leading-[1.08] tracking-tight font-display"
          >
            Financial Intelligence,{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)' }}
            >
              Reimagined
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-5 text-[15px] text-white/50 leading-relaxed max-w-md">
            AI-powered document analysis, risk scoring, and compliance automation built exclusively for Chartered Accountants.
          </motion.p>

          {/* Feature pills */}
          <motion.div variants={fadeUp} className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(99,102,241,0.12)' }}
                >
                  <f.icon size={15} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white/85">{f.label}</p>
                  <p className="text-[11px] text-white/35 leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={fadeUp}
            className="mt-10 flex items-center gap-6 xl:gap-10"
          >
            {STATS.map((s, i) => (
              <div key={i}>
                <p className="text-lg xl:text-xl font-bold text-white tracking-tight">{s.value}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom: Testimonial */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <div
            className="p-5 rounded-2xl max-w-md"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <RotatingTestimonials />
          </div>
        </motion.div>
      </div>

      {/* ─── Divider ─── */}
      <div className="hidden lg:block w-px self-stretch my-16" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06), transparent)' }} />

      {/* ─── RIGHT PANEL: Auth Form ─── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-y-auto">
        {/* Subtle gradient */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(124,58,237,0.03) 0%, transparent 50%)',
            }}
          />
        </div>

        {/* Back link */}
        <Link
          to="/"
          className="absolute top-6 left-6 lg:top-8 lg:right-8 lg:left-auto z-30 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="uppercase tracking-widest font-semibold text-[10px]">Back</span>
        </Link>

        {/* Mobile logo (shown below lg) */}
        <div className="lg:hidden mb-8">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Logo size="sm" />
          </Link>
        </div>

        <motion.div
          className="relative z-10 w-full max-w-[420px] px-6"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-[1.65rem] font-bold text-white tracking-tight font-display">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Sign in to your secure workspace
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-7 sm:p-8 relative overflow-hidden"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              boxShadow:
                '0 32px 64px -16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Top accent */}
            <div
              className="absolute top-0 left-6 right-6 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }}
            />

            {/* Google Sign-in */}
            <motion.button
              onClick={login}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              className="w-full h-[52px] bg-white hover:bg-gray-50 text-slate-800 flex items-center justify-center gap-3 rounded-xl text-sm font-semibold transition-colors duration-200 cursor-pointer relative overflow-hidden"
              style={{
                boxShadow: hovering
                  ? '0 8px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)'
                  : '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </motion.button>

            {/* SSO hint */}
            <div className="mt-4 flex items-center gap-2 justify-center">
              <Lock size={11} className="text-slate-600" />
              <span className="text-[11px] text-slate-600">SSO via Google Workspace supported</span>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.12em]">
                Enterprise Certified
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Compliance badges */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'SOC2-II', icon: ShieldCheck },
                { label: 'GDPR', icon: Globe },
                { label: 'DPDP', icon: Fingerprint },
                { label: 'HIPAA', icon: Lock },
              ].map((b) => (
                <div
                  key={b.label}
                  className="py-2.5 rounded-xl flex flex-col items-center justify-center gap-1.5 group transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <b.icon size={13} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 group-hover:text-slate-400 transition-colors">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Security features */}
          <motion.div
            className="mt-6 space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {[
              { icon: CheckCircle2, text: 'AES-256 encryption at rest & in transit' },
              { icon: CheckCircle2, text: 'Role-based access with audit trail' },
              { icon: CheckCircle2, text: '99.9% uptime with real-time monitoring' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 px-1">
                <f.icon size={13} className="text-emerald-500/60 shrink-0" />
                <span className="text-[12px] text-slate-500">{f.text}</span>
              </div>
            ))}
          </motion.div>

          {/* Footer */}
          <p className="text-center text-[11px] text-slate-600 mt-8 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="#" className="text-slate-400 underline underline-offset-2 hover:text-white transition-colors">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="#" className="text-slate-400 underline underline-offset-2 hover:text-white transition-colors">
              Privacy Policy
            </a>
          </p>

          {/* Mobile-only: Mini feature row */}
          <div className="lg:hidden mt-10 grid grid-cols-2 gap-2.5">
            {[
              { icon: Brain, text: 'AI-Powered' },
              { icon: Zap, text: 'Real-time' },
              { icon: ShieldCheck, text: 'Compliant' },
              { icon: BarChart3, text: 'Analytics' },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <f.icon size={13} className="text-indigo-400 shrink-0" />
                <span className="text-[11px] text-slate-500 font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
