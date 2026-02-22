import { useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, Loader2,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Info, FileText, ChevronRight, HelpCircle, IndianRupee, Brain
} from 'lucide-react';
import { runVendorFinancialAnalysis } from '../api/client';

interface Props {
  linkId: string;
  vendorName: string;
}

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;

export default function VendorFinancialsTab({ linkId, vendorName }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedUntraced, setExpandedUntraced] = useState<number | null>(null);

  const runAnalysis = async () => {
    setLoading(true); setError(null);
    try {
      const r = await runVendorFinancialAnalysis(linkId);
      setData(r.financialAnalysis);
    } catch (e: any) { setError(e?.response?.data?.error || 'Analysis failed'); }
    finally { setLoading(false); }
  };

  if (!data && !loading) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center mx-auto mb-4">
          <IndianRupee size={28} className="text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-main mb-2">Financial Intelligence</h3>
        <p className="text-sm text-dim max-w-md mx-auto mb-6">
          Deep analysis of {vendorName}'s financials — profit/loss, untraced money, tax gaps, and cash flow — all extracted from uploaded documents.
        </p>
        <button onClick={runAnalysis} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-main font-medium text-sm shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 transition-all">
          <Brain size={16} /> Run Financial Analysis
        </button>
        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 size={32} className="animate-spin text-emerald-400 mx-auto mb-4" />
        <p className="text-sm text-muted">Analyzing financial data from documents...</p>
        <p className="text-xs text-dim mt-1">Extracting P&L, tracing money flows, computing tax gaps</p>
      </div>
    );
  }

  const d = data;
  const hasExpenses = d.totalExpenses > 0;
  const isProfitable = d.grossProfit > 0;

  return (
    <div className="space-y-6">
      {/* FY + Overview Banner */}
      {(d.financialYear || d.documentTypes?.length > 0) && (
        <div className="rounded-xl border border-subtle bg-card-hover p-4 flex flex-wrap items-center gap-3">
          {d.financialYear && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-xs text-indigo-300 font-semibold">{d.financialYear}</span>
            </div>
          )}
          <span className="text-xs text-dim">{d.documentsAnalyzed} docs analyzed{d.documentsSkipped > 0 ? `, ${d.documentsSkipped} non-financial skipped` : ''}</span>
          {d.documentTypes?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-auto">
              {d.documentTypes.filter((dt: any) => dt.count > 0).map((dt: any) => (
                <span key={dt.type} className="text-[10px] px-2 py-0.5 rounded-full bg-subtle text-muted">
                  {dt.type.replace(/_/g, ' ')} ({dt.count}){dt.financialYear ? ` • ${dt.financialYear}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revenue Source Indicator */}
      {d.revenueSource && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <Info size={12} className="text-blue-400 shrink-0" />
          <span className="text-xs text-blue-300">Revenue & Expenses sourced from: <strong>{d.revenueSource}</strong></span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Total Revenue" value={fmt(d.totalRevenue)} icon={TrendingUp} color="emerald" sub={d.revenueSource || `${d.documentsAnalyzed - (d.documentsSkipped || 0)} financial docs`} />
        <KPICard label="Total Expenses" value={fmt(d.totalExpenses)} icon={TrendingDown} color="red" sub={hasExpenses ? `${d.expenseBreakdown.length} categories` : 'No expenses found'} />
        <KPICard label="Gross Profit" value={fmt(d.grossProfit)} icon={isProfitable ? ArrowUpRight : ArrowDownRight} color={isProfitable ? 'emerald' : 'red'}
          sub={`${pct(d.profitMargin)} margin`} highlight={!isProfitable} />
        <KPICard label="Net Profit (PAT)" value={fmt(d.netProfit)} icon={d.netProfit >= 0 ? TrendingUp : TrendingDown} color={d.netProfit >= 0 ? 'emerald' : 'red'}
          sub={`After tax • ${pct(d.profitMargin)}`} />
      </div>

      {/* Cash Flow (from Bank) */}
      {(d.totalInflow > 0 || d.totalOutflow > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Bank Credits" value={fmt(d.totalInflow)} icon={ArrowUpRight} color="blue" sub="Cash inflow" />
          <KPICard label="Bank Debits" value={fmt(d.totalOutflow)} icon={ArrowDownRight} color="purple" sub="Cash outflow" />
          <KPICard label="Net Cash Flow" value={fmt(d.netCashFlow)} icon={d.netCashFlow >= 0 ? TrendingUp : TrendingDown} color={d.netCashFlow >= 0 ? 'emerald' : 'red'} sub="Credits − Debits" />
          <KPICard label="Untraced Money" value={fmt(d.totalUntracedAmount)} icon={AlertTriangle} color={d.totalUntracedAmount > 0 ? 'amber' : 'emerald'}
            sub={d.untracedItems.length > 0 ? `${d.untracedItems.length} items need review` : 'All money traced'} highlight={d.totalUntracedAmount > 0} />
        </div>
      )}

      {/* Tax Overview */}
      {(d.totalTaxLiability > 0 || d.totalTaxPaid > 0 || d.incomeTaxSummary) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Tax Liability" value={fmt(d.totalTaxLiability)} icon={DollarSign} color="amber" sub="GST + TDS + Income Tax" />
          <KPICard label="Tax Paid" value={fmt(d.totalTaxPaid)} icon={DollarSign} color="emerald" sub="All taxes deposited" />
          <KPICard label="Tax Gap" value={d.taxGap > 0 ? fmt(d.taxGap) : '₹0 (NIL)'} icon={AlertTriangle} color={d.taxGap > 0 ? 'red' : 'emerald'} sub={d.taxGap > 0 ? 'Outstanding' : 'Fully paid'} highlight={d.taxGap > 0} />
          {d.incomeTaxSummary && (
            <KPICard label="Income Tax Status" value={d.incomeTaxSummary.gap > 0 ? fmt(d.incomeTaxSummary.gap) + ' gap' : 'Paid in Full'} icon={DollarSign} color={d.incomeTaxSummary.gap > 0 ? 'red' : 'emerald'}
              sub={d.incomeTaxSummary.liability > 0 ? `Liability ${fmt(d.incomeTaxSummary.liability)} • Paid ${fmt(d.incomeTaxSummary.paid)}` : 'No income tax data'} />
          )}
        </div>
      )}

      {/* P&L Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Expense Bar */}
        <div className="rounded-xl border border-subtle bg-card-hover p-5">
          <h4 className="text-sm font-medium text-main mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-indigo-400" /> Profit & Loss Overview</h4>
          <div className="space-y-4">
            <BarRow label="Revenue (from P&L)" value={d.totalRevenue} max={Math.max(d.totalRevenue, d.totalExpenses) || 1} color="emerald" />
            <BarRow label="Expenses (from P&L)" value={d.totalExpenses} max={Math.max(d.totalRevenue, d.totalExpenses) || 1} color="red" />
            <BarRow label="Gross Profit" value={d.grossProfit} max={Math.max(d.totalRevenue, d.totalExpenses) || 1} color="blue" />
            {d.incomeTaxSummary?.liability > 0 && (
              <BarRow label="Income Tax" value={d.incomeTaxSummary.liability} max={Math.max(d.totalRevenue, d.totalExpenses) || 1} color="amber" />
            )}
            <div className="pt-3 border-t border-subtle">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-main">Net Profit (PAT)</span>
                <span className={`text-lg font-bold ${d.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(d.netProfit)}</span>
              </div>
              <p className="text-xs text-dim mt-1">After taxes and deductions • {pct(d.profitMargin)} margin</p>
            </div>
            {d.totalInflow > 0 && (
              <div className="pt-3 border-t border-subtle">
                <p className="text-[10px] text-dim uppercase tracking-wider mb-2">Bank Cash Flow (separate from P&L)</p>
                <div className="space-y-2">
                  <BarRow label="Bank Credits" value={d.totalInflow} max={Math.max(d.totalInflow, d.totalOutflow) || 1} color="blue" />
                  <BarRow label="Bank Debits" value={d.totalOutflow} max={Math.max(d.totalInflow, d.totalOutflow) || 1} color="purple" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Revenue Breakdown Donut */}
        <div className="rounded-xl border border-subtle bg-card-hover p-5">
          <h4 className="text-sm font-medium text-main mb-4 flex items-center gap-2"><PieChart size={14} className="text-violet-400" /> Revenue Breakdown</h4>
          {d.revenueBreakdown.length > 0 ? (
            <div className="flex gap-6">
              <DonutChart data={d.revenueBreakdown} total={d.totalRevenue} />
              <div className="flex-1 space-y-2 min-w-0">
                {d.revenueBreakdown.slice(0, 6).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-xs text-muted truncate flex-1">{item.category}</span>
                    <span className="text-xs text-main font-medium shrink-0">{fmt(item.amount)}</span>
                    <span className="text-[10px] text-dim w-8 text-right shrink-0">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-dim text-center py-8">No revenue data extracted from documents.</p>}
        </div>
      </div>

      {/* Expense Breakdown */}
      {d.expenseBreakdown.length > 0 && (
        <div className="rounded-xl border border-subtle bg-card-hover p-5">
          <h4 className="text-sm font-medium text-main mb-4 flex items-center gap-2"><PieChart size={14} className="text-rose-400" /> Expense Breakdown</h4>
          <div className="flex gap-6">
            <DonutChart data={d.expenseBreakdown} total={d.totalExpenses} colors={EXPENSE_COLORS} />
            <div className="flex-1 space-y-2 min-w-0">
              {d.expenseBreakdown.slice(0, 6).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                  <span className="text-xs text-muted truncate flex-1">{item.category}</span>
                  <span className="text-xs text-main font-medium shrink-0">{fmt(item.amount)}</span>
                  <span className="text-[10px] text-dim w-8 text-right shrink-0">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tax Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-subtle bg-card-hover p-5">
          <h4 className="text-sm font-medium text-main mb-3 flex items-center gap-2"><DollarSign size={14} className="text-blue-400" /> GST Summary</h4>
          <div className="space-y-3">
            <TaxRow label="GST Collected" value={d.gstSummary.collected} color="blue" />
            <TaxRow label="Input Credit (ITC)" value={d.gstSummary.inputCredit} color="emerald" sub="Claimed" />
            <TaxRow label="Net GST Liability" value={d.gstSummary.netLiability} color={d.gstSummary.netLiability > 0 ? 'amber' : 'emerald'} />
            <TaxRow label="GST Paid" value={d.gstSummary.paid} color="emerald" />
            {d.gstSummary.netLiability - d.gstSummary.paid > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/10">
                <AlertTriangle size={12} className="text-red-400" />
                <span className="text-xs text-red-300">Gap: {fmt(d.gstSummary.netLiability - d.gstSummary.paid)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-subtle bg-card-hover p-5">
          <h4 className="text-sm font-medium text-main mb-3 flex items-center gap-2"><DollarSign size={14} className="text-purple-400" /> Income Tax (ITR)</h4>
          {d.incomeTaxSummary && d.incomeTaxSummary.liability > 0 ? (
            <div className="space-y-3">
              <TaxRow label="Tax Liability" value={d.incomeTaxSummary.liability} color="amber" />
              <TaxRow label="Tax Paid (TDS + Advance + Self-Assessment)" value={d.incomeTaxSummary.paid} color="emerald" />
              {d.incomeTaxSummary.gap > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/10">
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-xs text-red-300">Outstanding: {fmt(d.incomeTaxSummary.gap)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/10">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-xs text-emerald-300">Net Tax Payable: NIL — Fully Paid</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <TaxRow label="TDS Applicable" value={d.tdsSummary.applicable} color="purple" />
              <TaxRow label="TDS Deposited" value={d.tdsSummary.deposited} color="emerald" />
              {d.tdsSummary.gap > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/10">
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-xs text-red-300">TDS Gap: {fmt(d.tdsSummary.gap)} not deposited</span>
                </div>
              )}
              {d.tdsSummary.applicable === 0 && <p className="text-xs text-dim text-center py-4">No TDS / income tax data found in documents.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      {d.monthlyData.length > 0 && (
        <div className="rounded-xl border border-subtle bg-card-hover p-5">
          <h4 className="text-sm font-medium text-main mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-cyan-400" /> Cash Flow Trend</h4>
          <TrendChart data={d.monthlyData} />
        </div>
      )}

      {/* Cash Flow Reconciliation */}
      {d.untracedItems.length > 0 && (
        <div className={`rounded-xl border p-5 ${d.untracedItems.some((i: any) => i.severity === 'high') ? 'border-amber-500/10 bg-amber-500/[0.02]' : 'border-blue-500/10 bg-blue-500/[0.02]'}`}>
          <h4 className={`text-sm font-medium mb-1 flex items-center gap-2 ${d.untracedItems.some((i: any) => i.severity === 'high') ? 'text-amber-300' : 'text-blue-300'}`}>
            {d.untracedItems.some((i: any) => i.severity === 'high') ? <AlertTriangle size={14} /> : <Info size={14} />}
            Cash Flow Reconciliation — {fmt(d.totalUntracedAmount)}
          </h4>
          <p className="text-xs text-dim mb-4">Differences between P&L figures and bank cash flow. Low severity items are typically explained by balance sheet movements.</p>
          <div className="space-y-2">
            {d.untracedItems.map((item: any, i: number) => (
              <div key={i} className="rounded-xl border border-subtle bg-card-hover">
                <button onClick={() => setExpandedUntraced(expandedUntraced === i ? null : i)} className="w-full p-3 flex items-start gap-3 text-left">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.severity === 'high' ? 'bg-red-400' : item.severity === 'medium' ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-main">{fmt(item.amount)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.severity === 'high' ? 'bg-red-500/20 text-red-300' : item.severity === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-500/20 text-muted'}`}>{item.severity}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-subtle text-muted">{item.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-dim line-clamp-1">{item.description}</p>
                  </div>
                  <ChevronRight size={14} className={`text-dim mt-1 transition-transform ${expandedUntraced === i ? 'rotate-90' : ''}`} />
                </button>
                {expandedUntraced === i && (
                  <div className="px-3 pb-3 border-t border-subtle">
                    <div className="pl-5 space-y-2 pt-2">
                      <p className="text-xs text-muted">{item.description}</p>
                      {item.documentName && (
                        <div className="flex items-center gap-1 text-xs text-dim"><FileText size={10} /> {item.documentName}</div>
                      )}
                      <div className="flex items-start gap-2 bg-indigo-500/5 rounded-lg p-2.5 border border-indigo-500/10">
                        <Info size={10} className="text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-indigo-300">{item.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {(d.insights?.length > 0 || d.warnings?.length > 0 || d.recommendations?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {d.insights?.length > 0 && (
            <div className="rounded-xl border border-subtle bg-card-hover p-5">
              <h4 className="text-sm font-medium text-main mb-3 flex items-center gap-2"><Brain size={14} className="text-indigo-400" /> Key Insights</h4>
              <div className="space-y-2">
                {d.insights.map((ins: string, i: number) => (
                  <div key={i} className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" /><p className="text-xs text-muted leading-relaxed">{ins}</p></div>
                ))}
              </div>
            </div>
          )}
          {d.warnings?.length > 0 && (
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-5">
              <h4 className="text-sm font-medium text-amber-300 mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Warnings</h4>
              <div className="space-y-2">
                {d.warnings.map((w: string, i: number) => (
                  <div key={i} className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" /><p className="text-xs text-muted leading-relaxed">{w}</p></div>
                ))}
              </div>
            </div>
          )}
          {d.recommendations?.length > 0 && (
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-5">
              <h4 className="text-sm font-medium text-emerald-300 mb-3 flex items-center gap-2"><HelpCircle size={14} /> Recommendations</h4>
              <div className="space-y-2">
                {d.recommendations.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><p className="text-xs text-muted leading-relaxed">{r}</p></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Line Items — grouped by accounting category */}
      {(d.topRevenueItems?.length > 0 || d.topExpenseItems?.length > 0) && (
        <FinancialItemsGrouped items={[...(d.topRevenueItems || []), ...(d.topExpenseItems || []).map((i: any) => ({ ...i, amount: -i.amount }))]} />
      )}

      {/* Summary + Re-run */}
      <div className="rounded-xl border border-subtle bg-card-hover p-5">
        <p className="text-xs text-dim leading-relaxed mb-3">{d.summary}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-dim">Analyzed on {new Date(d.analysisDate).toLocaleString()} • {d.documentsAnalyzed} documents</span>
          <button onClick={runAnalysis} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />} Re-run Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Chart Components (SVG-based, no external deps)
// ============================================================

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff', '#818cf8'];
const EXPENSE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#fb923c', '#fca5a5', '#fecaca'];

const C: Record<string, { icon: string; fill: string; bg: string; border: string; glow: string }> = {
  emerald: { icon: '#34d399', fill: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)', glow: 'rgba(16,185,129,0.08)' },
  amber:   { icon: '#fbbf24', fill: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', glow: 'rgba(245,158,11,0.08)' },
  red:     { icon: '#f87171', fill: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.18)',  glow: 'rgba(239,68,68,0.08)' },
  indigo:  { icon: '#818cf8', fill: '#6366f1', bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.18)', glow: 'rgba(99,102,241,0.08)' },
  blue:    { icon: '#60a5fa', fill: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)', glow: 'rgba(59,130,246,0.08)' },
  purple:  { icon: '#a78bfa', fill: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.18)', glow: 'rgba(139,92,246,0.08)' },
  cyan:    { icon: '#22d3ee', fill: '#06b6d4', bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.18)',  glow: 'rgba(6,182,212,0.08)' },
};

function KPICard({ label, value, icon: Icon, color, sub, highlight }: { label: string; value: string; icon: any; color: string; sub?: string; highlight?: boolean }) {
  const c = C[color] || C.indigo;
  const hc = highlight ? (C[color === 'amber' ? 'amber' : 'red'] || C.red) : c;
  return (
    <div className="rounded-xl p-4 transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: hc.bg, border: `1px solid ${hc.border}`, boxShadow: `0 4px 16px ${hc.glow}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: c.icon }} />
        <span className="text-xs text-dim font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-main">{value}</p>
      {sub && <p className="text-[10px] text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pctVal = max > 0 ? Math.round((value / max) * 100) : 0;
  const c = C[color] || C.indigo;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-sm font-medium" style={{ color: c.icon }}>{fmt(value)}</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pctVal)}%`, background: c.fill }} />
      </div>
    </div>
  );
}

function TaxRow({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  const c = C[color] || C.indigo;
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs text-muted">{label}</span>
        {sub && <span className="text-[10px] text-dim ml-1">({sub})</span>}
      </div>
      <span className="text-sm font-medium" style={{ color: c.icon }}>{fmt(value)}</span>
    </div>
  );
}

function DonutChart({ data, total, colors }: { data: any[]; total: number; colors?: string[] }) {
  const c = colors || CHART_COLORS;
  const size = 120;
  const cx = size / 2, cy = size / 2, r = 42, strokeWidth = 16;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="shrink-0 relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
        {data.slice(0, 6).map((item: any, i: number) => {
          const pct = total > 0 ? item.amount / total : 0;
          const dashLen = circumference * pct;
          const dashOffset = circumference * offset;
          offset += pct;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={c[i % c.length]} strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={-dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="transition-all duration-700" />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-xs font-bold text-main">{fmt(total)}</span>
        <span className="text-[9px] text-dim">Total</span>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expenses]), 1);
  const h = 140, w_per_bar = 60;
  const totalW = Math.max(data.length * w_per_bar, 300);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalW }} className="relative">
        <div className="flex items-end gap-1" style={{ height: h }}>
          {data.map((m, i) => {
            const revH = (m.revenue / maxVal) * (h - 24);
            const expH = (m.expenses / maxVal) * (h - 24);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="flex gap-0.5 items-end" style={{ height: h - 20 }}>
                  <div className="w-3 rounded-t bg-emerald-500/80 transition-all duration-500" style={{ height: Math.max(2, revH) }} title={`Revenue: ${fmt(m.revenue)}`} />
                  <div className="w-3 rounded-t bg-red-500/60 transition-all duration-500" style={{ height: Math.max(2, expH) }} title={`Expenses: ${fmt(m.expenses)}`} />
                </div>
                <span className="text-[9px] text-dim truncate w-12 text-center">{m.month === 'Unknown' ? 'N/A' : m.month.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1 text-[10px] text-dim"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Revenue</span>
          <span className="flex items-center gap-1 text-[10px] text-dim"><span className="w-2 h-2 rounded-sm bg-red-500" /> Expenses</span>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  operating: { label: 'Operating', color: '#34d399', icon: '📊' },
  financing: { label: 'Financing / Cash Flow', color: '#60a5fa', icon: '🏦' },
  investing: { label: 'Investing / Balance Sheet', color: '#a78bfa', icon: '📈' },
  tax: { label: 'Tax / Compliance', color: '#fbbf24', icon: '🧾' },
  info: { label: 'Other', color: '#a0aec0', icon: '📄' },
};

function FinancialItemsGrouped({ items }: { items: any[] }) {
  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item.itemCategory || 'info';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  const order = ['operating', 'financing', 'investing', 'tax', 'info'];

  return (
    <div className="rounded-xl border border-subtle bg-card-hover p-5 space-y-5">
      <h4 className="text-sm font-medium text-main flex items-center gap-2" style={{ color: '#818cf8' }}><BarChart3 size={14} /> Financial Line Items</h4>
      {order.filter(k => groups[k]?.length > 0).map(cat => {
        const meta = CATEGORY_META[cat] || CATEGORY_META.info;
        const sorted = groups[cat].sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 8);
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">{meta.icon}</span>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
              <span className="text-[10px] text-dim">{groups[cat].length} items</span>
            </div>
            <div className="space-y-1">
              {sorted.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card-hover">
                  <span className="text-xs text-muted flex-1 truncate">{item.description}</span>
                  <span className="text-xs font-medium shrink-0" style={{ color: item.amount >= 0 ? '#34d399' : '#f87171' }}>{fmt(Math.abs(item.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
