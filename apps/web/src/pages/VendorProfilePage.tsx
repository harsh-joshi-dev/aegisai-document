import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, TrendingUp, TrendingDown, Minus, Shield,
  AlertTriangle, FileText, Calendar, Activity, BarChart3, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  getVendorIntelligence,
  type VendorIntelligenceResponse,
  type MonthlyTrendPoint,
} from '../api/client';

function PredictionGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{value}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-zinc-400 text-center">{label}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0e0e11] p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-display font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function VendorProfilePage() {
  const { vendorKey } = useParams();
  const [data, setData] = useState<VendorIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'trend' | 'documents' | 'patterns'>('overview');

  const fetchData = useCallback(async () => {
    if (!vendorKey) return;
    setLoading(true);
    try {
      const result = await getVendorIntelligence(vendorKey);
      setData(result);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [vendorKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trajectoryIcon = useMemo(() => {
    if (!data) return null;
    const t = data.predictions.overallRiskTrajectory;
    if (t === 'improving') return <TrendingDown size={16} className="text-emerald-400" />;
    if (t === 'deteriorating') return <TrendingUp size={16} className="text-red-400" />;
    return <Minus size={16} className="text-zinc-400" />;
  }, [data]);

  const trajectoryColor = useMemo(() => {
    if (!data) return 'text-zinc-400';
    const t = data.predictions.overallRiskTrajectory;
    if (t === 'improving') return 'text-emerald-400';
    if (t === 'deteriorating') return 'text-red-400';
    return 'text-zinc-400';
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <Building2 size={48} className="text-zinc-600" />
        <p className="text-zinc-400">Vendor not found</p>
        <Link to="/vendor-links" className="btn-secondary text-sm">Back to Vendors</Link>
      </div>
    );
  }

  const v = data.vendor;
  const p = data.predictions;
  const f = data.financials;

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <Link to="/vendor-links" className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Building2 size={20} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white">{v.name}</h1>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                  {v.gstin && <span className="font-mono">{v.gstin}</span>}
                  {v.gstin && <span>·</span>}
                  <span>{v.totalDocuments} documents</span>
                  <span>·</span>
                  <span className={`flex items-center gap-1 ${trajectoryColor}`}>
                    {trajectoryIcon}
                    {p.overallRiskTrajectory}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Prediction Confidence</p>
          <p className="text-2xl font-display font-bold text-white">{Math.round(p.confidence * 100)}%</p>
        </div>
      </div>

      {/* Predictive Risk Gauges */}
      <div className="card-premium p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield size={18} className="text-indigo-400" />
          <h2 className="font-display text-lg font-bold text-white">Predictive Risk Forecast</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
          <PredictionGauge label="Fraud Probability" value={p.fraudProbability} color={p.fraudProbability > 50 ? '#ef4444' : p.fraudProbability > 25 ? '#f59e0b' : '#10b981'} />
          <PredictionGauge label="Payment Default" value={p.paymentDefaultRisk} color={p.paymentDefaultRisk > 50 ? '#ef4444' : p.paymentDefaultRisk > 25 ? '#f59e0b' : '#10b981'} />
          <PredictionGauge label="Escalation Risk" value={p.escalationRisk} color={p.escalationRisk > 50 ? '#ef4444' : p.escalationRisk > 25 ? '#f59e0b' : '#10b981'} />
          <div className="space-y-2">
            {p.factors.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <Zap size={12} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-300 leading-relaxed">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Invoice Value" value={`₹${f.totalInvoiceValue.toLocaleString('en-IN')}`} />
        <StatCard label="Avg Invoice" value={`₹${f.avgInvoiceValue.toLocaleString('en-IN')}`} sub={`${f.invoiceCount} invoices`} />
        <StatCard label="Total GST Paid" value={`₹${f.totalGst.toLocaleString('en-IN')}`} />
        <StatCard
          label="Std Deviation"
          value={v.stats ? `₹${Math.round(v.stats.stdDev).toLocaleString('en-IN')}` : 'N/A'}
          sub={v.stats ? `Mean: ₹${Math.round(v.stats.meanAmount).toLocaleString('en-IN')}` : ''}
        />
      </div>

      {/* Tabs */}
      <div className="card-premium overflow-hidden">
        <div className="flex items-center border-b border-white/5 bg-white/[0.02]">
          {(['overview', 'trend', 'documents', 'patterns'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-500 text-white bg-indigo-500/5'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Activity size={14} className="text-zinc-400" /> Vendor Summary
                  </h3>
                  <div className="space-y-3">
                    {[
                      ['First Transaction', v.firstTransaction ? new Date(v.firstTransaction).toLocaleDateString('en-IN') : 'N/A'],
                      ['Last Transaction', v.lastTransaction ? new Date(v.lastTransaction).toLocaleDateString('en-IN') : 'N/A'],
                      ['Relationship Length', v.firstTransaction ? `${Math.ceil((Date.now() - new Date(v.firstTransaction).getTime()) / (30 * 24 * 60 * 60 * 1000))} months` : 'N/A'],
                      ['Document Count', String(v.totalDocuments)],
                    ].map(([k, val]) => (
                      <div key={k} className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-sm text-zinc-400">{k}</span>
                        <span className="text-sm font-medium text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-zinc-400" /> Risk Signal Summary
                  </h3>
                  <div className="space-y-2">
                    {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                      const count = data.riskSignalSummary[sev];
                      const colors: Record<string, string> = {
                        critical: 'bg-red-500',
                        high: 'bg-orange-500',
                        medium: 'bg-amber-500',
                        low: 'bg-zinc-600',
                      };
                      return (
                        <div key={sev} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${colors[sev]}`} />
                          <span className="text-sm text-zinc-400 capitalize flex-1">{sev}</span>
                          <span className="text-sm font-mono text-white">{count}</span>
                          <div className="w-24 h-1.5 rounded-full bg-white/5">
                            <div
                              className={`h-full rounded-full ${colors[sev]} transition-all duration-500`}
                              style={{ width: `${data.riskSignalSummary.total ? (count / data.riskSignalSummary.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Risk Heatmap */}
              {data.heatmap.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BarChart3 size={14} className="text-zinc-400" /> Risk Heatmap (12 months)
                  </h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.heatmap} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0e0e11', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                        <Bar dataKey="rule" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} name="Rule Violations" />
                        <Bar dataKey="pattern" stackId="a" fill="#f59e0b" name="Patterns" />
                        <Bar dataKey="anomaly" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Anomalies" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'trend' && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp size={14} className="text-zinc-400" /> Vendor Risk Trend
              </h3>
              {data.monthlyTrend.length > 0 ? (
                <>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.monthlyTrend}>
                        <defs>
                          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="amountGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0e0e11', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                        <Area yAxisId="left" type="monotone" dataKey="avgRiskScore" stroke="#6366f1" fill="url(#riskGrad)" name="Avg Risk Score" />
                        <Area yAxisId="right" type="monotone" dataKey="docCount" stroke="#10b981" fill="url(#amountGrad)" name="Documents" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[200px]">
                    <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider">Monthly Invoice Volume</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthlyTrend} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0e0e11', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                          formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                        />
                        <Bar dataKey="totalAmount" name="Total Amount" radius={[6, 6, 0, 0]}>
                          {data.monthlyTrend.map((entry: MonthlyTrendPoint, index: number) => (
                            <Cell key={index} fill={entry.highRiskCount > 0 ? '#ef4444' : '#6366f1'} fillOpacity={0.7} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-zinc-500 text-sm text-center py-12">No trend data available yet</p>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-3 animate-in fade-in">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText size={14} className="text-zinc-400" /> Recent Documents
              </h3>
              {data.recentDocuments.map(doc => {
                const levelColors: Record<string, string> = {
                  safe: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
                };
                return (
                  <Link
                    key={doc.id}
                    to={`/document/${doc.id}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-[#16161a] hover:border-indigo-500/30 hover:bg-[#1c1c21] transition-all group"
                  >
                    <FileText size={18} className="text-zinc-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">{doc.filename}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
                        {doc.amount != null && ` · ₹${doc.amount.toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${levelColors[doc.riskLevel] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                      {doc.riskLevel?.toUpperCase()}
                    </span>
                    {doc.riskScore != null && (
                      <span className="text-xs font-mono text-zinc-400">{doc.riskScore}</span>
                    )}
                  </Link>
                );
              })}
              {data.recentDocuments.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-12">No documents found</p>
              )}
            </div>
          )}

          {tab === 'patterns' && (
            <div className="space-y-3 animate-in fade-in">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar size={14} className="text-zinc-400" /> Pattern History
              </h3>
              {data.patternHistory.map((event, idx) => {
                const sevColors: Record<string, string> = {
                  HIGH: 'bg-orange-500',
                  CRITICAL: 'bg-red-500',
                  MEDIUM: 'bg-amber-500',
                  LOW: 'bg-zinc-600',
                };
                return (
                  <div key={idx} className="flex gap-3 p-3 rounded-xl border border-white/5 bg-[#16161a]">
                    <div className="mt-1">
                      <div className={`w-2 h-2 rounded-full ${sevColors[event.severity] || 'bg-zinc-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate">{event.title}</p>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{event.eventType}</p>
                    </div>
                  </div>
                );
              })}
              {data.patternHistory.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-12">No pattern events recorded</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
