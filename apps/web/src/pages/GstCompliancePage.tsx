import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  IndianRupee,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react';
import {
  runGstReconciliation,
  getRegulatoryCalendar,
  type GstReconciliationResult,
  type GstReconciliationMismatch,
  type RegulatoryDeadline,
} from '../api/client';
import { useToast } from '../state/toast';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/30 bg-red-500/5 text-red-300',
  high: 'border-orange-500/30 bg-orange-500/5 text-orange-300',
  medium: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  low: 'border-zinc-600/30 bg-zinc-800/30 text-zinc-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  GST: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  TDS: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Income Tax': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ROC: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'ESI/PF': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display font-bold text-white">{score}%</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Match</span>
      </div>
    </div>
  );
}

function MismatchRow({ m }: { m: GstReconciliationMismatch }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${SEVERITY_COLORS[m.severity] || SEVERITY_COLORS.low}`}>
      <div className="flex justify-between items-start gap-2 mb-1">
        <span className="font-semibold text-white">{m.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-400 font-mono uppercase">
          {m.severity}
        </span>
      </div>
      <p className="text-zinc-400 text-xs leading-relaxed mb-1">{m.description}</p>
      {m.itcImpact != null && m.itcImpact > 0 && (
        <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
          <IndianRupee size={12} /> ITC at risk: ₹{m.itcImpact.toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}

function DeadlineCard({ d }: { d: RegulatoryDeadline }) {
  const now = new Date();
  const dueDate = new Date(d.dueDate);
  const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntil < 0;
  const isUrgent = daysUntil >= 0 && daysUntil <= 7;

  return (
    <div className={`rounded-xl border p-4 transition-all hover:border-white/20 ${
      isOverdue ? 'border-red-500/30 bg-red-500/5' :
      isUrgent ? 'border-amber-500/30 bg-amber-500/5' :
      'border-white/10 bg-white/[0.02]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${CATEGORY_COLORS[d.category] || ''}`}>
            {d.category}
          </span>
          {isOverdue && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
              OVERDUE
            </span>
          )}
        </div>
        <span className={`text-xs font-mono ${isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-zinc-500'}`}>
          {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-white mb-1">{d.title}</h4>
      <p className="text-xs text-zinc-400 leading-relaxed mb-2">{d.description}</p>
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-xs text-zinc-500">{new Date(d.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <button
          type="button"
          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
          onClick={() => {
            const tooltip = d.penaltyInfo;
            alert(tooltip);
          }}
        >
          View penalty info
        </button>
      </div>
    </div>
  );
}

export default function GstCompliancePage() {
  const { push } = useToast();
  const [tab, setTab] = useState<'reconciliation' | 'calendar'>('calendar');

  // Reconciliation state
  const [reconResult, setReconResult] = useState<GstReconciliationResult | null>(null);
  const [reconLoading, setReconLoading] = useState(false);

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [deadlines, setDeadlines] = useState<RegulatoryDeadline[]>([]);
  const [upcoming, setUpcoming] = useState<RegulatoryDeadline[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [calLoading, setCalLoading] = useState(false);
  const [calFilter, setCalFilter] = useState<string>('all');

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await getRegulatoryCalendar({ month: calMonth, year: calYear });
      setDeadlines(res.deadlines);
      setUpcoming(res.upcoming);
      setOverdue(res.overdue);
    } catch {
      push({ kind: 'error', title: 'Failed to load calendar', message: 'Could not fetch regulatory deadlines.' });
    } finally {
      setCalLoading(false);
    }
  }, [calMonth, calYear, push]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const filteredDeadlines = useMemo(() => {
    if (calFilter === 'all') return deadlines;
    return deadlines.filter(d => d.category === calFilter);
  }, [deadlines, calFilter]);

  const runReconciliation = async () => {
    setReconLoading(true);
    try {
      const res = await runGstReconciliation();
      setReconResult(res.reconciliation);
      push({ kind: 'success', title: 'Reconciliation complete', message: `${res.reconciliation.matched} matched, ${res.reconciliation.mismatches.length} discrepancies found.` });
    } catch {
      push({ kind: 'error', title: 'Reconciliation failed', message: 'Could not run GST reconciliation.' });
    } finally {
      setReconLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">GST & Compliance</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
          GSTR-2A/2B reconciliation, regulatory calendar, and compliance deadline tracking for Indian finance teams.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 w-fit border border-white/5">
        {[
          { id: 'calendar' as const, label: 'Regulatory Calendar', icon: Calendar },
          { id: 'reconciliation' as const, label: 'GST Reconciliation', icon: FileSearch },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Calendar Tab */}
      {tab === 'calendar' && (
        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
                  else setCalMonth(m => m - 1);
                }}
                className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-display font-bold text-white min-w-[180px] text-center">
                {monthNames[calMonth - 1]} {calYear}
              </h2>
              <button
                onClick={() => {
                  if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
                  else setCalMonth(m => m + 1);
                }}
                className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {['all', 'GST', 'TDS', 'Income Tax', 'ROC', 'ESI/PF'].map(f => (
                <button
                  key={f}
                  onClick={() => setCalFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    calFilter === f
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'text-zinc-500 border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card-premium p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-indigo-500/10">
                <Calendar size={20} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">{filteredDeadlines.length}</p>
                <p className="text-xs text-zinc-500">Deadlines This Month</p>
              </div>
            </div>
            <div className="card-premium p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <CheckCircle size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">{upcoming.length}</p>
                <p className="text-xs text-zinc-500">Upcoming</p>
              </div>
            </div>
            <div className="card-premium p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">{overdue}</p>
                <p className="text-xs text-zinc-500">Overdue</p>
              </div>
            </div>
          </div>

          {/* Deadline Cards */}
          {calLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-indigo-400" size={24} />
              <span className="ml-3 text-sm text-zinc-400">Loading deadlines…</span>
            </div>
          ) : filteredDeadlines.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Shield size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No deadlines for this month/category.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDeadlines.map(d => <DeadlineCard key={d.id} d={d} />)}
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Tab */}
      {tab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-bold text-white">GSTR-2A/2B Reconciliation</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Cross-references your purchase invoices against GST return data to catch ITC mismatches.
              </p>
            </div>
            <button
              onClick={runReconciliation}
              disabled={reconLoading}
              className="btn-primary shadow-lg shadow-indigo-500/20 gap-2"
            >
              {reconLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {reconLoading ? 'Running…' : 'Run Reconciliation'}
            </button>
          </div>

          {!reconResult && !reconLoading && (
            <div className="card-premium flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <FileSearch size={32} className="text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Ready to Reconcile</h3>
              <p className="text-sm text-zinc-400 max-w-md">
                Upload your purchase invoices and GSTR-2A/2B filings, then click "Run Reconciliation" to identify mismatches and protect your ITC claims.
              </p>
            </div>
          )}

          {reconResult && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="card-premium p-4 flex flex-col items-center">
                  <ScoreRing score={reconResult.summary.reconciliationScore} />
                  <p className="text-xs text-zinc-500 mt-2">Reconciliation Score</p>
                </div>
                <div className="card-premium p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle size={16} />
                    <span className="text-sm font-semibold">{reconResult.matched} Matched</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-semibold">{reconResult.mismatched} Mismatched</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle size={16} />
                    <span className="text-sm font-semibold">{reconResult.missingInGstr} Missing in GSTR</span>
                  </div>
                </div>
                <div className="card-premium p-4">
                  <p className="text-xs text-zinc-500 mb-1">Total GST</p>
                  <p className="text-lg font-bold text-white">₹{reconResult.summary.totalGst.toLocaleString('en-IN')}</p>
                  <div className="mt-2 space-y-1 text-xs text-zinc-400">
                    <p>CGST: ₹{reconResult.summary.totalCgst.toLocaleString('en-IN')}</p>
                    <p>SGST: ₹{reconResult.summary.totalSgst.toLocaleString('en-IN')}</p>
                    <p>IGST: ₹{reconResult.summary.totalIgst.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="card-premium p-4">
                  <p className="text-xs text-zinc-500 mb-1">ITC at Risk</p>
                  <p className={`text-lg font-bold ${reconResult.summary.itcAtRisk > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    ₹{reconResult.summary.itcAtRisk.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
                    {reconResult.summary.itcAtRisk > 0 ? 'Resolve before GSTR-3B filing' : 'No ITC at risk'}
                  </p>
                </div>
                <div className="card-premium p-4">
                  <p className="text-xs text-zinc-500 mb-1">Documents Analyzed</p>
                  <p className="text-lg font-bold text-white">{reconResult.totalInvoices + reconResult.totalGstrRecords}</p>
                  <div className="mt-2 space-y-1 text-xs text-zinc-400">
                    <p>{reconResult.totalInvoices} Invoices</p>
                    <p>{reconResult.totalGstrRecords} GSTR records</p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {reconResult.recommendations.length > 0 && (
                <div className="card-premium p-5">
                  <h3 className="text-sm font-bold text-white mb-3">Recommendations</h3>
                  <div className="space-y-2">
                    {reconResult.recommendations.map((r, i) => (
                      <div key={i} className="flex gap-3 text-sm text-zinc-300">
                        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
                          {i + 1}
                        </span>
                        <p>{r}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mismatches */}
              {reconResult.mismatches.length > 0 && (
                <div className="card-premium p-5">
                  <h3 className="text-sm font-bold text-white mb-3">
                    Discrepancies ({reconResult.mismatches.length})
                  </h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {reconResult.mismatches.map((m, i) => (
                      <MismatchRow key={i} m={m} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
