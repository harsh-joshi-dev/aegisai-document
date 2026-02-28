import { useState, useEffect, useRef } from 'react';
import {
  Globe, Cpu, FileText, Shield, ChevronRight, Star, Zap, TrendingUp,
  Brain, SearchCode, Database, RefreshCw, BarChart4,
  ArrowUpRight, Quote, ArrowRight, ShieldCheck, Users, Lock,
  BarChart3, BadgeCheck, ShieldAlert, FileSearch,
  Mail, Phone, MapPin, Send
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoModal } from '../ui/DemoModal';
import { ContactModal } from '../ui/ContactModal';
import { Logo } from '../components/ui/Logo';
import { BrandIcon } from '../components/ui/BrandIcon';
import { useAuth } from '../state/auth';

const featurePillars = [
  {
    title: 'Intelligent Document Processing',
    desc: 'Extract structured financial data from invoices, GST returns, P&L, contracts, and bank statements automatically.',
    Icon: FileText,
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.05))',
    border: 'rgba(59,130,246,0.2)',
    iconColor: '#60a5fa',
    iconBg: 'rgba(59,130,246,0.1)',
    glow: 'rgba(59,130,246,0.2)',
    path: '/documents'
  },
  {
    title: 'Risk Intelligence Engine',
    desc: 'Unified AI-driven risk scoring with rule-based validation and cross-document anomaly detection.',
    Icon: ShieldCheck,
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))',
    border: 'rgba(99,102,241,0.2)',
    iconColor: '#818cf8',
    iconBg: 'rgba(99,102,241,0.1)',
    glow: 'rgba(99,102,241,0.2)',
    path: '/rules'
  },
  {
    title: 'Vendor & Approval Workflow',
    desc: 'Secure vendor portal, review cycles, approval lifecycle, and comprehensive audit trails.',
    Icon: Users,
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.05))',
    border: 'rgba(168,85,247,0.2)',
    iconColor: '#c084fc',
    iconBg: 'rgba(168,85,247,0.1)',
    glow: 'rgba(168,85,247,0.2)',
    path: '/vendor-links'
  },
  {
    title: 'Compliance & Governance',
    desc: 'Built-in GDPR and DPDP compliance, audit logs, data retention policies, and automated enforcement.',
    Icon: Shield,
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.05))',
    border: 'rgba(16,185,129,0.2)',
    iconColor: '#34d399',
    iconBg: 'rgba(16,185,129,0.1)',
    glow: 'rgba(16,185,129,0.2)',
    path: '/reports'
  }
];

const stats = [
  { value: '99.9%', label: 'Extraction Accuracy', icon: TrendingUp },
  { value: '10x', label: 'Faster Audit Cycles', icon: Zap },
  { value: '₹0', label: 'Implementation Cost', icon: Star },
  { value: '24/7', label: 'Automated Monitoring', icon: ShieldCheck },
];

const logos = [
  { name: 'Global Finance', icon: Globe },
  { name: 'SecureBank', icon: Lock },
  { name: 'DataCorp', icon: Cpu },
  { name: 'AuditLogix', icon: BarChart3 },
  { name: 'TrustShield', icon: ShieldCheck },
];

const testimonials = [
  {
    quote: "CA.Dynamix has transformed how we approach internal audits. We've reduced leakage by 18% in just six months while saving our finance team hundreds of hours in manual review.",
    name: 'Siddharth Jain',
    title: 'Managing Partner',
    company: 'Elite CA Services',
    initials: 'SJ',
    color: '#6366f1',
    metric: '18% Savings'
  },
  {
    quote: "The AI risk engine catches patterns that our human reviewers would miss. It's like having a senior analyst reviewing every document in real-time.",
    name: 'Priya Sharma',
    title: 'Chief Financial Officer',
    company: 'NextGen Auditx',
    initials: 'PS',
    color: '#8b5cf6',
    metric: '99% Accuracy'
  },
  {
    quote: "Implementation was seamless. We were up and running in days, not months. The automated vendor portal alone justifies the investment.",
    name: 'Amit Verma',
    title: 'Audit Director',
    company: 'V-Guard Financial',
    initials: 'AV',
    color: '#ec4899',
    metric: 'Instant ROI'
  },
];

const caseStudies = [
  {
    id: 1,
    title: '₹4.2Cr Recovery for Petrochem Giant',
    category: 'GSTR-2B Matching',
    desc: 'Identified chronic GST ITC leakages and unclaimed credits spanning 24 months of historical filings.',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
    tags: ['Automated Audit', 'ITC Recovery'],
    result: '₹4.2 Cr Recovered'
  },
  {
    id: 2,
    title: '120hrs/mo Saved for SME Audit Firm',
    category: 'Document Automation',
    desc: 'Automated invoice extraction and P&L validation for over 200 concurrent clients.',
    image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1200',
    tags: ['Efficiency', 'Scalability'],
    result: '120hrs saved/mo'
  },
  {
    id: 3,
    title: 'Real-time Vendor Compliance',
    category: 'Risk Intelligence',
    desc: 'Eliminated manual vendor follow-ups through automated document collection and instant validation.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200',
    tags: ['Monitoring', 'Compliance'],
    result: '100% On-time Filing'
  }
];

const advancedCapabilities = [
  { title: "GSTR-2B Reconciliation", desc: "Automated matching of sales and purchase registers with government filings.", icon: RefreshCw },
  { title: "P&L Anomaly Detection", desc: "AI-driven identification of unusual expense patterns or potential leakage.", icon: SearchCode },
  { title: "Bank Statement OCR", desc: "Instant extraction of transaction data with automatic category mapping.", icon: Database },
  { title: "TDS/TCS Compliance", desc: "Verification of tax deduction rates against historical data and current rules.", icon: BadgeCheck },
  { title: "Multi-Entity Auditing", desc: "Unified dashboard for group companies and multi-branched entities.", icon: BarChart4 },
  { title: "Fraud Intelligence", desc: "Cross-document verification to catch duplicate or fictitious invoices.", icon: ShieldAlert },
];

const steps = [
  { num: '01', title: 'Data Ingestion', desc: 'Securely upload PDFs, Excel files, or connect via direct API integrations.', icon: FileText },
  { num: '02', title: 'AI Extraction', desc: 'Our neural engines extract and structure data with over 99.9% accuracy.', icon: Brain },
  { num: '03', title: 'Intelligent Audit', desc: 'Run custom rules and risk models to flag anomalies and compliance gaps.', icon: SearchCode },
  { num: '04', title: 'Decision ROI', desc: 'Export verified reports and act on intelligently prioritized insights.', icon: TrendingUp },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [demoOpen, setDemoOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIdx(i => (i + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ backgroundColor: '#030304', color: '#fff', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes shimmer-bar { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.6); } }
      `}</style>

      {/* ── Background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 1200, height: 1200, background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: 800, height: 800, background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 60%)', borderRadius: '50%' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025 }}>
          <defs>
            <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,1)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* ── Navbar ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: scrolled ? 68 : 90,
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        background: scrolled ? 'rgba(3,3,4,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Logo size="sm" />
          </Link>

          {/* Nav links - hidden on small screens */}
          <nav className="hidden md:flex" style={{ gap: 32, alignItems: 'center' }}>
            {[
              { label: 'Why CA.Dynamix', href: '#features' },
              { label: 'Case Studies', href: '/case-studies', isRoute: true },
              { label: 'Pricing', href: '/pricing', isRoute: true },
              { label: 'About', href: '/about', isRoute: true },
              { label: 'Security', href: '#security' },
              { label: 'Contact', onClick: () => setContactOpen(true) },
            ].map(item => (
              item.isRoute ? (
                <Link key={item.label} to={item.href || '#'} style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s', letterSpacing: '-0.02em' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.label}
                  href={item.href}
                  onClick={item.onClick}
                  style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s', letterSpacing: '-0.02em', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
                  {item.label}
                </a>
              )
            ))}
          </nav>

          {/* Right CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
              Portal Access
            </Link>
            <Link to="/auth" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 40, padding: '0 22px', borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 13,
              textDecoration: 'none', boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(79,70,229,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(79,70,229,0.35)'; }}>
              Start Free Trial <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 160, paddingBottom: 140, position: 'relative', zIndex: 1 }} ref={heroRef}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 60, alignItems: 'center' }}>

          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
              <BrandIcon size={12} />
              Financial Decision OS v4.2
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(48px, 6vw, 80px)', lineHeight: 1.03, letterSpacing: '-0.04em', margin: 0, color: '#fff' }}>
              AI Decision<br />
              <span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Intelligence</span><br />
              for Modern CAs
            </h1>

            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, maxWidth: 520, margin: 0 }}>
              CA.Dynamix is the premier AI-First Decision Intelligence OS for modern financial practices. We unify cognitive document auditing, predictive risk signals, and automated compliance into a high-fidelity workspace empowering Chartered Accountants to lead with absolute precision and strategic foresight.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setDemoOpen(true)} style={{
                height: 54, padding: '0 32px', borderRadius: 14,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 16px 48px rgba(79,70,229,0.45)',
                transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 64px rgba(79,70,229,0.55)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(79,70,229,0.45)'; }}>
                Request Demo <ArrowRight size={18} />
              </button>
              <Link to="/auth" style={{
                height: 54, padding: '0 32px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, fontSize: 14,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                Start Free Trial
              </Link>
            </div>

            {/* Stats */}
            <div style={{ paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 24 }}>
              {stats.map(stat => (
                <div key={stat.label}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 30, color: '#6366f1', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 8 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Risk Audit Card */}
          <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            style={{ animation: 'float 6s ease-in-out infinite' }}
          >
            <div style={{
              background: 'rgba(12,12,16,0.85)', backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 28, padding: 32,
              boxShadow: '0 60px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(79,70,229,0.08)',
              position: 'relative', overflow: 'hidden',
            }}>

              {/* Top glow */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)' }} />
              <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: '80%', height: 80, background: 'rgba(79,70,229,0.08)', filter: 'blur(24px)', pointerEvents: 'none' }} />

              {/* Fake window controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', opacity: 0.8 }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', opacity: 0.8 }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', opacity: 0.8 }} />
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>CA_DYNAMIX-CORE.AI</span>
              </div>

              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', border: '1px solid rgba(79,70,229,0.2)' }}>
                    <FileSearch size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>GST Invoice Audit</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4, letterSpacing: '0.05em' }}>GSTR-2B-COMP-99</div>
                  </div>
                </div>
                <span style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Risk Flag Raised
                </span>
              </div>

              {/* Alerts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}>
                  <div style={{ color: '#f87171', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'pulse-slow 1.5s infinite' }} />
                    ITC Mismatch
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>Input Tax Credit claim for <strong style={{ color: '#fff' }}>Proprietary Assets</strong> exceeds supplier filing by 12%.</div>
                </div>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
                  <div style={{ color: '#818cf8', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={11} />
                    Decision Engine
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>Verified against past 24 months of filings. Supplier "Alpha Corp" has a history of delayed GSTR-1 filings.</div>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[{ label: 'Severity', value: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' }, { label: 'Extraction', value: '99.8%', color: '#10b981', bg: 'rgba(16,185,129,0.08)' }].map(m => (
                  <div key={m.label} style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', background: m.bg }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button style={{ height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
                  Reject
                </button>
                <button style={{ height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 20px rgba(79,70,229,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  Audit Context
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── LOGO CLOUD ── */}
      <section style={{ padding: '48px 0', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 800, letterSpacing: '0.4em', textTransform: 'uppercase' }}>Empowering Modern Financial Excellence</p>
        </div>
        {/* Marquee */}
        <div style={{ display: 'flex', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 80, animation: 'marquee 20s linear infinite', whiteSpace: 'nowrap' }}>
            {[...logos, ...logos].map((logo, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em', flexShrink: 0 }}>
                <logo.icon size={18} style={{ color: 'rgba(99,102,241,0.4)' }} />
                {logo.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CA.DYNAMIX ── */}
      <section id="features" style={{ padding: '140px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 88 }}>
            <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Value Proposition</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(40px, 5vw, 64px)', letterSpacing: '-0.04em', lineHeight: 1.03, margin: '0 0 20px', color: '#fff' }}>
              Why CA.Dynamix?
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>A unified intelligence layer that sits on top of your financial documents and workflows.</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {featurePillars.map((pillar, idx) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => navigate(isAuthenticated ? pillar.path : '/auth')}
                style={{ cursor: 'pointer' }}
              >
                <div style={{
                  background: 'rgba(10,10,14,0.6)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderRadius: 24, padding: '36px 28px', height: '100%',
                  transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                  position: 'relative', overflow: 'hidden',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.border = `1px solid ${pillar.border}`;
                    el.style.transform = 'translateY(-6px)';
                    el.style.background = pillar.gradient;
                    el.style.boxShadow = `0 24px 64px ${pillar.glow}, 0 0 0 1px ${pillar.border}`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.border = '1px solid rgba(255,255,255,0.06)';
                    el.style.transform = 'translateY(0)';
                    el.style.background = 'rgba(10,10,14,0.6)';
                    el.style.boxShadow = 'none';
                  }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: pillar.iconBg, border: `1px solid ${pillar.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 0 24px',
                  }}>
                    <pillar.Icon size={28} style={{ color: pillar.iconColor }} />
                  </div>
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 17, color: '#fff', marginBottom: 12, lineHeight: 1.3 }}>{pillar.title}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>{pillar.desc}</p>
                  <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 6, color: pillar.iconColor, fontSize: 12, fontWeight: 700 }}>
                    Learn more <ChevronRight size={14} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADVANCED CAPABILITIES GRID ── */}
      <section style={{ padding: '140px 0', position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 60, alignItems: 'center' }}>
            <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div style={{ fontSize: 10, color: '#ec4899', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Granular Control</div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 4vw, 54px)', letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: 24, color: '#fff' }}>
                Every financial corner,{' '}
                <span style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>covered.</span>
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 44 }}>From GST mandates to intricate P&L audits, our advanced modules adapt to your specific operational scale.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                {advancedCapabilities.slice(0, 4).map(cap => (
                  <div key={cap.title}>
                    <cap.icon size={20} style={{ color: '#ec4899', marginBottom: 12 }} />
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cap.title}</h4>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>{cap.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -40, background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', filter: 'blur(32px)', zIndex: -1 }} />
              <div style={{ background: 'rgba(15,15,20,0.8)', padding: 12, borderRadius: 32, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200"
                  alt="Platform Interface"
                  style={{ width: '100%', borderRadius: 24, display: 'block' }}
                />
              </div>
              <div style={{ position: 'absolute', bottom: -20, left: -20, background: 'rgba(236,72,153,0.9)', color: '#fff', padding: '20px 24px', borderRadius: 24, boxShadow: '0 20px 40px rgba(236,72,153,0.3)' }}>
                <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Outfit,sans-serif' }}>50M+</div>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', opacity: 0.8 }}>DOCUMENTS AUDITED</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CASE STUDIES ── */}
      <section style={{ padding: '140px 0', background: 'rgba(255,255,255,0.012)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 80 }}>
            <div style={{ maxWidth: 520 }}>
              <div style={{ fontSize: 10, color: '#4f46e5', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Evidence of Excellence</div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 4vw, 54px)', letterSpacing: '-0.04em', lineHeight: 1.08, color: '#fff' }}>Case Studies</h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginTop: 24 }}>Real-world impact across various financial sectors and firm sizes.</p>
            </div>
            <button
              onClick={() => navigate('/case-studies')}
              style={{ height: 48, padding: '0 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}>
              View All Insights <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32 }}>
            {caseStudies.map((study, idx) => (
              <motion.div
                key={study.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => navigate('/case-studies')}
                style={{ cursor: 'pointer' }}
                className="group"
              >
                <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', marginBottom: 24, height: 260 }}>
                  <img src={study.image} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }} className="group-hover:scale-105" />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%)' }} />
                  <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: 8 }}>
                    {study.tags.map(tag => (
                      <span key={tag} style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 9, fontWeight: 700 }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{study.category}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.3 }}>{study.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 20 }}>{study.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 800, fontSize: 13 }}>
                    {study.result}
                    <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.1)', margin: '0 12px' }} />
                    <ArrowUpRight size={16} className="text-indigo-400" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section style={{ padding: '140px 0', borderTop: '1px solid rgba(255,255,255,0.04)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 100 }}>
            <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>How it Works</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.04em', lineHeight: 1, color: '#fff' }}>Simple. Automated. Absolute.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40, position: 'relative' }}>
            {/* Connection Line */}
            <div style={{ position: 'absolute', top: 40, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2) 20%, rgba(139,92,246,0.2) 80%, transparent)', zIndex: -1 }} className="hidden lg:block" />

            {steps.map((step, idx) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 28, background: 'rgba(15,15,20,0.8)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                  <step.icon size={32} style={{ color: '#8b5cf6' }} />
                  <div style={{ position: 'absolute', top: -10, right: -10, width: 32, height: 32, borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{step.num}</div>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 16 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 200, margin: '0 auto' }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section id="security" style={{ padding: '140px 0', background: 'rgba(255,255,255,0.012)', borderTop: '1px solid rgba(255,255,255,0.04)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 60, alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Enterprise Security</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 4vw, 54px)', letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: 24, color: '#fff' }}>
              Bank-Grade Security,{' '}
              <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Zero Compromise</span>
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 44, maxWidth: 480 }}>Every byte of your financial data is protected by military-grade encryption, strict access controls, and regular compliance audits.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['SOC2 Type II Certified', 'GDPR & DPDP Compliant', 'AES-256 Encryption at Rest', 'Zero-Knowledge Architecture'].map((item, i) => (
                <motion.div key={item} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
                    <ShieldCheck size={15} />
                  </div>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ background: 'rgba(12,12,16,0.85)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 28, padding: 40, boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 80px rgba(79,70,229,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Shield size={24} style={{ color: '#818cf8' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>Security Posture</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Real-time infrastructure monitoring</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse-slow 2s infinite' }} />
                  <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700, letterSpacing: '0.1em' }}>LIVE</span>
                </div>
              </div>
              {[
                { label: 'Threat Detection', val: 99, color: '#6366f1' },
                { label: 'Compliance Score', val: 98, color: '#8b5cf6' },
                { label: 'Data Integrity', val: 100, color: '#10b981' },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: row.color, fontWeight: 800, fontFamily: 'Outfit,sans-serif' }}>{row.val}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${row.val}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                      style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${row.color}, ${row.color}aa)`, boxShadow: `0 0 12px ${row.color}44` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '160px 0', position: 'relative', zIndex: 1, background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.03), transparent)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Testimonials</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 4vw, 54px)', letterSpacing: '-0.04em', color: '#fff' }}>Loved by Leading Firms</h2>
          </div>

          <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIdx}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: 'rgba(15,15,20,0.6)',
                  backdropFilter: 'blur(32px)',
                  borderRadius: 40,
                  padding: '60px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 60px 120px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40, border: '4px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 40px rgba(99,102,241,0.2)' }}>
                  <Quote size={40} style={{ color: '#fff' }} fill="currentColor" />
                </div>

                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(20px, 2.5vw, 32px)', lineHeight: 1.4, color: 'rgba(255,255,255,0.9)', marginBottom: 48, maxWidth: 800 }}>
                  "{testimonials[testimonialIdx].quote}"
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: `linear-gradient(135deg, ${testimonials[testimonialIdx].color}, #4f46e5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 900, fontFamily: 'Outfit,sans-serif' }}>
                    {testimonials[testimonialIdx].initials}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{testimonials[testimonialIdx].name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>{testimonials[testimonialIdx].title} · {testimonials[testimonialIdx].company}</div>
                  </div>
                  <div style={{ height: 40, width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 10px' }} />
                  <div style={{ padding: '8px 16px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 11, fontWeight: 800 }}>
                    {testimonials[testimonialIdx].metric}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 48 }}>
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTestimonialIdx(i)}
                  style={{
                    width: i === testimonialIdx ? 32 : 10,
                    height: 10,
                    borderRadius: 999,
                    background: i === testimonialIdx ? '#6366f1' : 'rgba(255,255,255,0.15)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 32px 140px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
              borderRadius: 32, padding: '88px 72px', textAlign: 'center',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 60px 120px rgba(79,70,229,0.5)',
            }}>
            {/* BG decoration */}
            <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, background: 'rgba(0,0,0,0.1)', borderRadius: '50%' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', marginBottom: 28, fontSize: 10, color: '#fff', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                <Zap size={11} />
                Limited Pilot Spots Available
              </div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 20, color: '#fff' }}>
                Modernize Your<br />Audit Lifecycle
              </h2>
              <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', maxWidth: 480, margin: '0 auto 48px', lineHeight: 1.7 }}>
                Join hundreds of forward-thinking Chartered Accountants already using CA.Dynamix to build trust and eliminate errors.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Link to="/auth" style={{ height: 58, padding: '0 40px', borderRadius: 16, background: '#fff', color: '#4f46e5', fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 16px 40px rgba(0,0,0,0.2)', transition: 'all 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 48px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.2)'; }}>
                  Start Free Trial <ArrowRight size={16} />
                </Link>
                <button onClick={() => setDemoOpen(true)} style={{ height: 58, padding: '0 40px', borderRadius: 16, background: 'rgba(0,0,0,0.18)', color: '#fff', fontWeight: 800, fontSize: 15, border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.28)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.18)')}>
                  Request Demo
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="enterprise" style={{ padding: '140px 0', borderTop: '1px solid rgba(255,255,255,0.04)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 80 }}>
            <div>
              <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Global Command</div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 4vw, 54px)', letterSpacing: '-0.04em', lineHeight: 1.08, color: '#fff', marginBottom: 32 }}>Let's Redefine Your <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Audit Standards</span></h2>
              <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 48, maxWidth: 480 }}>Schedule a strategic assessment with our intelligence officers and discover the future of cognitive accounting.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {[
                  { icon: Mail, label: 'Transmission', value: 'hello@cadynamix.ai' },
                  { icon: Phone, label: 'Direct Line', value: '+91 (0) 800-AUDIT-AI' },
                  { icon: MapPin, label: 'Headquarters', value: 'Intelligence District, Bangalore' }
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                      <item.icon size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -20, background: 'linear-gradient(135deg, #4f46e520, #a855f710)', borderRadius: 48, filter: 'blur(40px)', zIndex: -1 }} />
              <div style={{ background: 'rgba(15,15,20,0.6)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 40, padding: 48, boxShadow: '0 40px 80px rgba(0,0,0,0.4)' }}>
                <form onSubmit={e => { e.preventDefault(); alert('Transmission Received. Intelligence officers will contact you shortly.'); }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginLeft: 4 }}>Legal Name</label>
                      <input required placeholder="John Doe" style={{ height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', color: '#fff', fontSize: 14, outline: 'none', transition: 'all 0.2s' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginLeft: 4 }}>Business Email</label>
                      <input required type="email" placeholder="john@firm.com" style={{ height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', color: '#fff', fontSize: 14, outline: 'none', transition: 'all 0.2s' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginLeft: 4 }}>Practice Intelligence Needs</label>
                    <select style={{ height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', color: '#fff', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                      <option>Audit Automation</option>
                      <option>GST Reconciliation</option>
                      <option>Vendor Risk Management</option>
                      <option>Full Practice Digitization</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginLeft: 4 }}>Briefing Details</label>
                    <textarea placeholder="How can our AI help your firm?..." style={{ height: 120, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'none' }} />
                  </div>
                  <button type="submit" style={{ height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', border: 'none', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, transition: 'all 0.3s' }}>
                    Send Briefing <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#000', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '80px 32px 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 64 }}>
            <div>
              <Logo size="sm" className="mb-6" />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.75, maxWidth: 280 }}>Artificial Intelligence purpose-built for the rigorous standards of modern Chartered Accountancy firms.</p>
              <div style={{ display: 'flex', gap: 2, marginTop: 28 }}>
                {['SOC2', 'GDPR', 'ISO 27001'].map(b => (
                  <div key={b} style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: '0.1em', marginRight: 4 }}>{b}</div>
                ))}
              </div>
            </div>
            {[
              { title: 'Platform', links: [{ label: 'Risk Engine', path: '/rules' }, { label: 'Document AI', path: '/documents' }, { label: 'Compliance', path: '/gst-compliance' }, { label: 'Integrations', path: '/integrations' }, { label: 'Pricing', path: '/pricing' }] },
              { title: 'Legal', links: [{ label: 'Privacy Policy', path: '/privacy' }, { label: 'Terms of Use', path: '/terms' }, { label: 'Audit Log', path: '/audit-log' }, { label: 'Case Studies', path: '/case-studies' }] },
              { title: 'Company', links: [{ label: 'About Us', path: '/about' }, { label: 'Careers', path: '/careers' }, { label: 'Blog', path: '/blog' }, { label: 'Contact', path: '/contact' }] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>{col.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {col.links.map(link => (
                    <Link key={link.label} to={link.path} style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.32)')}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>© 2026 CA.Dynamix. All rights reserved.</p>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Terms', path: '/terms' },
                { label: 'Privacy', path: '/privacy' },
                { label: 'Cookies', path: '#' }
              ].map(link => (
                <Link key={link.label} to={link.path} style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
