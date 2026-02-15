import { useState } from 'react';
import { ArrowRight, FileSearch, ShieldCheck, Sparkles, Workflow, Zap, CheckCircle2, Play, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemoModal } from '../ui/DemoModal';

const features = [
  {
    label: 'Risk Detection',
    Icon: ShieldCheck,
    desc: 'Flag mismatches, missing fields, and anomalies instantly.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20'
  },
  {
    label: 'Cross-Match',
    Icon: Workflow,
    desc: 'Detect repeated amounts and vendor spikes across docs.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  },
  {
    label: 'Explainable AI',
    Icon: Sparkles,
    desc: 'Understand exactly why a document was flagged.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20'
  },
  {
    label: 'Audit Reports',
    Icon: FileSearch,
    desc: 'Generate audit-ready decision summaries in one click.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20'
  },
];

export default function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#030304] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030304]/80 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <span className="font-display font-bold text-white text-xl">A</span>
            </div>
            <div>
              <p className="font-display font-bold text-lg tracking-tight text-white leading-none">Aegis AI</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mt-0.5">Decision Intel</p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <Link to="/auth" className="hidden md:block text-sm font-medium text-zinc-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              to="/auth"
              className="group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-lg bg-indigo-600 px-6 font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <span className="mr-2">Get Started</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative pt-32 pb-20 w-full">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
          <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px] mix-blend-screen" />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#030304] to-transparent" />
        </div>

        {/* Hero Section */}
        <section className="relative z-10 max-w-7xl mx-auto px-6 lg:grid lg:grid-cols-2 lg:gap-16 items-center min-h-[80vh]">
          <div className="space-y-10 py-10 lg:py-0">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Zap size={14} className="fill-current" />
              <span>AI Risk Engine v2.0 Live</span>
            </div>

            <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              Catch Financial <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient flow-text">Mistakes</span> <br />
              Before Approval.
            </h1>

            <p className="text-xl text-zinc-400 max-w-xl leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
              Aegis AI proactively reads your financial documents, highlights risks with plain-English explanations, and helps you avoid costly errors.
            </p>

            <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
              <Link
                to="/auth"
                className="h-14 px-8 rounded-xl bg-white font-semibold text-lg hover:bg-zinc-200 transition-all transform hover:-translate-y-1 hover:shadow-xl shadow-white/10 flex items-center gap-2"
                style={{ color: '#000' }}
              >
                Start Free Trial
                <ArrowRight size={20} />
              </Link>
              <button
                className="h-14 px-8 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur-sm flex items-center gap-2"
                onClick={() => setDemoOpen(true)}
              >
                <Play size={20} fill="currentColor" className="opacity-80" />
                Watch Demo
              </button>
            </div>

            <div className="pt-10 border-t border-white/5 grid grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
              {[
                ['99.9%', 'Accuracy'],
                ['10x', 'Faster Audit'],
                ['$0', 'Setup Cost']
              ].map(([label, sub]) => (
                <div key={label}>
                  <p className="font-display text-3xl font-bold text-white">{label}</p>
                  <p className="text-sm text-zinc-500 font-medium uppercase tracking-wide mt-1">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative mt-16 lg:mt-0 w-full perspective-1000 animate-in zoom-in-95 duration-1000 delay-300">
            {/* Glow behind visual */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-600/10 rounded-full blur-3xl -z-10" />

            <div className="relative transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 ease-out preserve-3d">
              <div className="rounded-2xl border border-white/10 bg-[#0e0e11]/90 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-mono text-zinc-400">
                    analysis_engine.py
                  </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Scanning Document</p>
                      <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                        <FileSearch size={24} className="text-indigo-400" />
                        Invoice_Jan_2026.pdf
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase animate-pulse">
                      Critical Risk
                    </span>
                  </div>

                  {/* Analysis Block */}
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 transition-colors hover:bg-red-500/10 group cursor-default">
                      <div className="flex gap-4">
                        <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400 h-fit group-hover:scale-110 transition-transform">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="font-semibold text-red-200">Amount Mismatch Detected</p>
                          <p className="text-sm text-red-200/60 mt-1 leading-relaxed">
                            Invoice total <span className="text-red-200 font-mono">₹120,000</span> does not match PO #4092 limit of <span className="text-red-200 font-mono">₹100,000</span>.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 transition-colors hover:bg-indigo-500/10 group cursor-default">
                      <div className="flex gap-4">
                        <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 h-fit group-hover:scale-110 transition-transform">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <p className="font-semibold text-indigo-200">AI Recommendation</p>
                          <p className="text-sm text-indigo-200/60 mt-1 leading-relaxed">
                            Flag for manual review. Suggest requesting revised invoice from vendor.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex gap-4">
                    <button className="flex-1 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5">
                      Reject Invoice
                    </button>
                    <button className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-semibold text-sm hover:bg-white/10 transition-colors border border-white/10">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-7xl mx-auto px-6 py-32">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="font-display text-4xl font-bold text-white mb-6">Built for Decision Quality</h2>
            <p className="text-lg text-zinc-400">Everything you need to audit, approve, and analyze financial documents with confidence.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ label, Icon, desc, color, bg, border }) => (
              <div
                key={label}
                className={`group relative p-8 rounded-3xl border border-white/5 bg-[#0e0e11] hover:bg-[#16161a] transition-all duration-300 hover:-translate-y-2`}
              >
                <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border ${border}`} />
                <div className={`w-14 h-14 rounded-2xl ${bg} ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={28} />
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-3">{label}</h3>
                <p className="text-zinc-400 leading-relaxed text-sm">{desc}</p>

                <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <ChevronRight className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="max-w-7xl mx-auto px-6 pb-32">
          <div className="rounded-[40px] p-8 md:p-16 border border-white/5 bg-gradient-to-b from-[#0e0e11] to-black relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[120px] -z-10" />

            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-display text-4xl font-bold text-white mb-8">How it Works</h2>
                <div className="space-y-10">
                  {['Upload Documents', 'AI Analyzes Risk', 'Review & Approve'].map((step, idx) => (
                    <div key={step} className="flex gap-6 group">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-500 group-hover:border-indigo-500 group-hover:text-indigo-400 transition-all bg-[#030304] z-10 relative">
                          {idx + 1}
                        </div>
                        {idx !== 2 && <div className="absolute top-10 left-1/2 -translate-x-1/2 h-16 w-px bg-zinc-800" />}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-zinc-300 group-hover:text-white transition-colors">{step}</h4>
                        <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
                          {idx === 0 && "Drag & drop PDF invoices, POs, or receipts. We support bulk uploads."}
                          {idx === 1 && "Our risk engine scans for 50+ types of anomalies instantly."}
                          {idx === 2 && "Make a data-backed decision with 1-click audit reports."}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Link to="/auth" className="btn-primary inline-flex h-12 px-8 mt-6">
                    Get Started Now
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-2xl border border-white/10 bg-black/50 p-6 backdrop-blur-md shadow-2xl">
                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                    <span className="text-xs font-mono text-zinc-500">terminal@aegis-ai ~ %</span>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    </div>
                  </div>
                  <div className="space-y-4 font-mono text-sm leading-relaxed">
                    <div className="flex gap-3 animate-in fade-in slide-in-from-left duration-500 delay-100">
                      <span className="text-green-500">➜</span>
                      <span className="text-zinc-300">upload --file invoice_2024.pdf</span>
                    </div>
                    <div className="flex gap-3 animate-in fade-in slide-in-from-left duration-500 delay-300">
                      <span className="text-blue-500">ℹ</span>
                      <span className="text-zinc-400">Scanning document structure...</span>
                    </div>
                    <div className="flex gap-3 animate-in fade-in slide-in-from-left duration-500 delay-500">
                      <span className="text-blue-500">ℹ</span>
                      <span className="text-zinc-400">Extracting entities (Vendor, Amount, PO)...</span>
                    </div>
                    <div className="flex gap-3 animate-in fade-in slide-in-from-left duration-500 delay-700">
                      <span className="text-amber-500">⚠</span>
                      <span className="text-amber-200">Warning: Amount mismatch (PO: 50k, Inv: 55k)</span>
                    </div>
                    <div className="flex gap-3 animate-in fade-in slide-in-from-left duration-500 delay-1000 pl-4 border-l-2 border-green-500/30">
                      <CheckCircle2 size={16} className="text-green-500" />
                      <span className="text-green-400">Analysis Complete. Risk Score: 78/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
