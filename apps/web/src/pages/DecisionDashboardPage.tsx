import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert, UploadCloud, Activity, CheckCircle, Clock, Calendar, IndianRupee, BarChart3, Building2, TrendingUp, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { MetricCard } from '../ui/MetricCard';
import { RiskBadge } from '../ui/RiskBadge';
import { UploadModal, type UploadPayload } from '../ui/UploadModal';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../state/workspace';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { useAuth } from '../state/auth';
import { uploadFile, getRegulatoryCalendar, getVendorDirectory, type RegulatoryDeadline } from '../api/client';

export default function DecisionDashboardPage() {
  const [openUpload, setOpenUpload] = useState(false);
  const [onlyMyApprovals, setOnlyMyApprovals] = useState(false);
  const [viewMode, setViewMode] = useState<'operational' | 'executive'>('operational');
  const { activeWorkspace } = useWorkspace();
  const { documents, activity, refreshDocuments } = useStore();
  const { push } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const actionableStatuses = useMemo(
    () => new Set(['pending', 'review_required', 'pending_info', 'under_review', 'needs_info']),
    []
  );

  const workspaceDocs = useMemo(() => {
    const base = documents.filter((d) => d.workspaceId === activeWorkspace.id);
    if (!onlyMyApprovals) return base;
    const email = user?.email;
    if (!email) return base;
    return base.filter((d) => d.assignedTo === email && actionableStatuses.has(d.status));
  }, [documents, activeWorkspace.id, onlyMyApprovals, user?.email, actionableStatuses]);

  const alertsWithDoc = useMemo(() => {
    const risky = workspaceDocs.filter(
      (d) => actionableStatuses.has(d.status) && (d.riskLevel === 'Critical' || d.riskLevel === 'High')
    );
    return risky.flatMap((d) => {
      const items: { message: string; docId: string; docName: string }[] = [];
      if (d.issues.length)
        items.push({
          message: d.issues[0].title + (d.issues[0].title.endsWith('.') ? '' : '.'),
          docId: d.id,
          docName: d.name,
        });
      if (d.patternAlerts.length)
        items.push({ message: d.patternAlerts[0], docId: d.id, docName: d.name });
      if (!items.length) items.push({ message: `${d.riskLevel} risk requires review`, docId: d.id, docName: d.name });
      return items;
    });
  }, [workspaceDocs, actionableStatuses]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const total = workspaceDocs.length;
    const pending = workspaceDocs.filter((d) => actionableStatuses.has(d.status)).length;
    const high = workspaceDocs.filter((d) => d.riskLevel === 'High').length;
    const critical = workspaceDocs.filter((d) => d.riskLevel === 'Critical').length;
    const overdue = workspaceDocs.filter((d) => !d.escalatedAt && d.slaDueAt && new Date(d.slaDueAt).getTime() < now).length;
    const escalated = workspaceDocs.filter((d) => !!d.escalatedAt).length;
    return { total, pending, high, critical, overdue, escalated };
  }, [workspaceDocs]);

  const recentActivity = useMemo(() => {
    return (activity || [])
      .filter((a) => a.workspaceId === activeWorkspace.id)
      .slice(0, 8);
  }, [activity, activeWorkspace.id]);


  const distribution = useMemo(
    () => ({
      Safe: workspaceDocs.filter((d) => d.riskLevel === 'Safe').length,
      Review: workspaceDocs.filter((d) => d.riskLevel === 'Review Required').length,
      High: workspaceDocs.filter((d) => d.riskLevel === 'High').length,
      Critical: workspaceDocs.filter((d) => d.riskLevel === 'Critical').length,
    }),
    [workspaceDocs]
  );

  const pieData = useMemo(
    () => [
      { name: 'Safe', value: distribution.Safe, color: '#10b981' }, // Emerald 500
      { name: 'Review', value: distribution.Review, color: '#f59e0b' }, // Amber 500
      { name: 'High', value: distribution.High, color: '#f97316' }, // Orange 500
      { name: 'Critical', value: distribution.Critical, color: '#ef4444' }, // Red 500
    ],
    [distribution]
  );

  const barData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));
    workspaceDocs.forEach((doc) => {
      const dayIdx = new Date(doc.createdAt || doc.date).getDay();
      counts[days[dayIdx]] = (counts[days[dayIdx]] || 0) + 1;
    });
    return days.map((d) => ({ name: d, value: counts[d] }));
  }, [workspaceDocs]);

  const myQueueItems = useMemo(
    () =>
      workspaceDocs
        .filter((d) => d.assignedTo === user?.email && actionableStatuses.has(d.status))
        .slice(0, 5),
    [workspaceDocs, user?.email, actionableStatuses]
  );

  // Compliance reminders
  const [complianceDeadlines, setComplianceDeadlines] = useState<RegulatoryDeadline[]>([]);
  const fetchDeadlines = useCallback(async () => {
    try {
      const res = await getRegulatoryCalendar();
      setComplianceDeadlines(res.upcoming.slice(0, 4));
    } catch { /* best-effort */ }
  }, []);
  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  const fetchVendors = useCallback(async () => {
    try {
      await getVendorDirectory();
    } catch { /* best-effort */ }
  }, []);
  useEffect(() => { if (viewMode === 'executive') fetchVendors(); }, [viewMode, fetchVendors]);

  // Executive metrics
  const execMetrics = useMemo(() => {
    const totalExposure = workspaceDocs.reduce((s, d) => s + (d.amount || 0), 0);
    const highRiskExposure = workspaceDocs
      .filter(d => d.riskLevel === 'High' || d.riskLevel === 'Critical')
      .reduce((s, d) => s + (d.amount || 0), 0);
    const vendorSet = new Set(workspaceDocs.map(d => d.vendor).filter(Boolean));
    const topVendorDocs = new Map<string, number>();
    workspaceDocs.forEach(d => {
      if (d.vendor) topVendorDocs.set(d.vendor, (topVendorDocs.get(d.vendor) || 0) + 1);
    });
    const topConcentration = [...topVendorDocs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const approvedCount = workspaceDocs.filter(d => d.status === 'approved').length;
    const rejectedCount = workspaceDocs.filter(d => d.status === 'rejected').length;
    const complianceHealth = workspaceDocs.length > 0
      ? Math.round(((workspaceDocs.length - (metrics.critical + metrics.high)) / workspaceDocs.length) * 100)
      : 100;

    // Monthly anomaly trend
    const monthBuckets = new Map<string, { total: number; anomalies: number }>();
    workspaceDocs.forEach(d => {
      const dt = new Date(d.createdAt || d.date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthBuckets.has(key)) monthBuckets.set(key, { total: 0, anomalies: 0 });
      const b = monthBuckets.get(key)!;
      b.total++;
      if (d.riskLevel === 'High' || d.riskLevel === 'Critical') b.anomalies++;
    });
    const anomalyTrend = [...monthBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }));

    return {
      totalExposure,
      highRiskExposure,
      vendorCount: vendorSet.size,
      topConcentration,
      approvedCount,
      rejectedCount,
      complianceHealth,
      anomalyTrend,
    };
  }, [workspaceDocs, metrics]);

  return (
    <div className="w-full space-y-8 pb-12 animate-in fade-in duration-700">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
            Monitor real-time risks, track approval workflows, and mitigate anomalies.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-xl border border-white/5 bg-[var(--bg-subtle)] p-0.5 shadow-inner">
            <button
              onClick={() => setViewMode('operational')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'operational'
                ? 'bg-indigo-500/10 text-indigo-400 shadow-sm ring-1 ring-indigo-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <Eye size={12} className="inline mr-1 -mt-0.5" />
              Operational
            </button>
            <button
              onClick={() => setViewMode('executive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'executive'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <BarChart3 size={12} className="inline mr-1 -mt-0.5" />
              Executive
            </button>
          </div>
          {viewMode === 'operational' && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/5 bg-[var(--bg-subtle)] px-4 py-2 text-xs font-bold text-zinc-400 hover:bg-[var(--bg-card-hover)] hover:text-zinc-200 hover:border-white/10 transition-all select-none shadow-sm">
              <input
                type="checkbox"
                className="accent-indigo-500 h-4 w-4 rounded bg-zinc-800 border-zinc-700 focus:ring-offset-0 focus:ring-0 checked:bg-indigo-500 checked:border-transparent transition-colors cursor-pointer"
                checked={onlyMyApprovals}
                onChange={(e) => setOnlyMyApprovals(e.target.checked)}
              />
              <span>My Approvals</span>
            </label>
          )}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenUpload(true); }}
            className="btn-primary shadow-lg shadow-indigo-500/20"
          >
            <UploadCloud size={18} />
            <div className="ml-2">
            Upload Document
            </div>
          </button>
        </div>
      </div>

      {/* ============ EXECUTIVE VIEW ============ */}
      {viewMode === 'executive' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Executive KPIs */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total Risk Exposure" value={`₹${execMetrics.totalExposure.toLocaleString('en-IN')}`} icon={<IndianRupee size={20} />} description="Sum of all document amounts" />
            <MetricCard title="High Risk Exposure" value={`₹${execMetrics.highRiskExposure.toLocaleString('en-IN')}`} icon={<ShieldAlert size={20} />} description="Amount in high/critical risk docs" />
            <MetricCard title="Compliance Health" value={`${execMetrics.complianceHealth}%`} icon={<CheckCircle size={20} />} description="Documents passing risk checks" />
            <MetricCard title="Active Vendors" value={execMetrics.vendorCount} icon={<Building2 size={20} />} description="Unique vendors in workspace" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Risk Exposure Summary */}
            <div className="xl:col-span-2 space-y-6">
              <div className="card-premium p-6">
                <h3 className="font-display text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-400" />
                  Monthly Anomaly Trend
                </h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={execMetrics.anomalyTrend}>
                      <defs>
                        <linearGradient id="anomGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="month" stroke="#52525b" fontSize={11} axisLine={false} tickLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0e0e11', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#totalGrad)" name="Total Docs" />
                      <Area type="monotone" dataKey="anomalies" stroke="#ef4444" fill="url(#anomGrad)" name="Anomalies" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Vendor Concentration */}
              <div className="card-premium p-6">
                <h3 className="font-display text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-400" />
                  Vendor Concentration
                </h3>
                <div className="space-y-3">
                  {execMetrics.topConcentration.map(([vendor, count], idx) => {
                    const pct = workspaceDocs.length ? Math.round((count / workspaceDocs.length) * 100) : 0;
                    return (
                      <div key={vendor} className="flex items-center gap-3">
                        <span className="w-5 text-xs text-zinc-500 font-mono">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-zinc-200 truncate">{vendor}</span>
                            <span className="text-xs text-zinc-400 font-mono">{count} docs ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {execMetrics.topConcentration.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-8">No vendor data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Approval Funnel */}
              <div className="card-premium p-6">
                <h3 className="font-display text-lg font-bold text-white mb-4">Decision Funnel</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Total Processed', value: metrics.total, color: 'bg-indigo-500', pct: 100 },
                    { label: 'Pending Review', value: metrics.pending, color: 'bg-amber-500', pct: metrics.total ? Math.round((metrics.pending / metrics.total) * 100) : 0 },
                    { label: 'Approved', value: execMetrics.approvedCount, color: 'bg-emerald-500', pct: metrics.total ? Math.round((execMetrics.approvedCount / metrics.total) * 100) : 0 },
                    { label: 'Rejected', value: execMetrics.rejectedCount, color: 'bg-red-500', pct: metrics.total ? Math.round((execMetrics.rejectedCount / metrics.total) * 100) : 0 },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-zinc-400">{item.label}</span>
                        <span className="text-sm font-bold text-white">{item.value}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compliance Health Ring */}
              <div className="card-premium p-6 flex flex-col items-center">
                <h3 className="font-display text-lg font-bold text-white mb-4 self-start">Compliance Health</h3>
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={execMetrics.complianceHealth >= 80 ? '#10b981' : execMetrics.complianceHealth >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - execMetrics.complianceHealth / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-display font-bold text-white">{execMetrics.complianceHealth}%</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Health Score</span>
                  </div>
                </div>
              </div>

              {/* Compliance Reminders (shared) */}
              {complianceDeadlines.length > 0 && (
                <div className="card-premium flex flex-col max-h-[300px]">
                  <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-white">Upcoming Deadlines</h3>
                    <Calendar size={14} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="space-y-2">
                      {complianceDeadlines.map(d => {
                        const daysUntil = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={d.id} className={`rounded-lg border p-2 ${daysUntil <= 7 ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-[#16161a]'}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-zinc-200 truncate">{d.title}</span>
                              <span className={`text-[10px] font-mono ${daysUntil <= 7 ? 'text-amber-400' : 'text-zinc-500'}`}>{daysUntil}d</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ OPERATIONAL VIEW ============ */}
      {viewMode === 'operational' && <>
        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div onClick={() => navigate('/documents', { state: { preset: 'all' } })} className="cursor-pointer">
            <MetricCard
              title="Total Processed"
              value={metrics.total}
              trend={{ value: '12%', positive: true }}
              icon={<Activity size={20} />}
              description="Across all document types"
            />
          </div>
          <div onClick={() => navigate('/documents', { state: { preset: 'pending_review' } })} className="cursor-pointer">
            <MetricCard
              title="Pending Review"
              value={metrics.pending}
              icon={<Clock size={20} />}
              description="Awaiting decision"
            />
          </div>
          <div onClick={() => navigate('/documents', { state: { preset: 'overdue' } })} className="cursor-pointer">
            <MetricCard
              title="SLA Breached"
              value={metrics.overdue}
              icon={<AlertTriangle size={20} />}
              description="Requires immediate attention"
            />
          </div>
          <div onClick={() => navigate('/documents', { state: { preset: 'escalated' } })} className="cursor-pointer">
            <MetricCard
              title="High Risks"
              value={metrics.critical + metrics.high}
              icon={<ShieldAlert size={20} />}
              description="Critical anomalies detected"
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 xl:grid-cols-3 w-full">

          {/* Charts Section */}
          <div className="xl:col-span-2 space-y-6">
            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Risk Analysis</h3>
                  <p className="text-xs text-zinc-500 mt-1">Distribution across current workload</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-center h-[300px]">
                {/* Donut Chart */}
                <div className="h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={4}
                        stroke="none"
                        cornerRadius={6}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0e0e11', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}
                        formatter={(value: number) => [`${value} Docs`, 'Count']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stats */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-display font-bold text-white">{metrics.total}</span>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1">Total Docs</span>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#52525b"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="#52525b"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 4 }}
                        contentStyle={{ backgroundColor: '#0e0e11', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                      />
                      <Bar
                        dataKey="value"
                        fill="url(#barGradient)"
                        radius={[6, 6, 0, 0]}
                      />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Activity Stream */}
            <div className="card-premium p-6">
              <h3 className="font-display text-lg font-bold text-white mb-6">Recent Activity</h3>
              <div className="space-y-6 relative">
                {recentActivity.length > 0 ? (
                  // Timeline line
                  <>
                    <div className="absolute left-[19px] top-4 bottom-4 w-[1px] bg-[var(--border-subtle)]" />
                    {recentActivity.map((ev) => (
                      <div key={ev.id} className="relative flex gap-4 pl-1 group">
                        <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] ring-4 ring-[var(--bg-card)] group-hover:border-indigo-500/30 transition-all duration-300">
                          <Activity size={14} className="text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{ev.message}</p>
                            <span className="text-xs text-zinc-600 whitespace-nowrap">
                              {new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500">{ev.actorEmail?.split('@')[0]}</span>
                            {ev.docId && (
                              <>
                                <span className="text-zinc-700">•</span>
                                <Link to={`/document/${ev.docId}`} className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline underline-offset-2">
                                  View Document
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <p>No recent activity found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Queue & Alerts */}
          <div className="space-y-6">

            {/* My Queue */}
            <div className="card-premium flex flex-col h-[420px]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">My Queue</h3>
                  <p className="text-xs text-zinc-500">{metrics.pending} pending assigned to you</p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400">
                  <Clock size={16} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {myQueueItems.length > 0 ? (
                  <div className="space-y-3">
                    {myQueueItems.map((d) => (
                      <Link
                        key={d.id}
                        to={`/document/${d.id}`}
                        className="group block rounded-xl bg-[var(--bg-subtle)]/50 border border-white/5 p-4 hover:border-indigo-500/30 hover:bg-[var(--bg-card-hover)] transition-all hover:shadow-lg"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="min-w-0 pr-2">
                            <p className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">{d.name}</p>
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">{d.vendor}</p>
                          </div>
                          <RiskBadge level={d.riskLevel} />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          <span className="text-xs font-mono text-zinc-400">₹{d.amount.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                            Review →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                      <CheckCircle size={32} className="text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-white">All Caught Up!</p>
                    <p className="text-xs mt-1 max-w-[200px]">You have no pending items in your queue.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Alerts */}
            <div className="card-premium flex flex-col max-h-[400px]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-red-500/[0.02]">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Critical Alerts</h3>
                  <p className="text-xs text-zinc-500">Requires immediate action</p>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500 animate-ping rounded-full opacity-20"></div>
                  <div className="relative p-2 rounded-lg bg-red-500/10 text-red-500">
                    <ShieldAlert size={16} />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {alertsWithDoc.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500">
                    <p className="text-sm">No active alerts.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alertsWithDoc.map((a, idx) => (
                      <Link
                        key={`${idx}-${a.docId}-${a.message.slice(0, 20)}`}
                        to={`/document/${a.docId}`}
                        className="group block rounded-xl border border-red-500/10 bg-red-500/5 p-4 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:shadow-[0_4px_12px_rgba(239,68,68,0.1)] relative overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500/50" />
                        <div className="flex gap-3 pl-2">
                          <AlertTriangle className="mt-0.5 text-red-400 shrink-0" size={16} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-red-200 group-hover:text-red-100 transition-colors">
                              {a.message}
                            </p>
                            <p className="mt-1 text-xs text-red-400/60 truncate">Ref: {a.docName}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Compliance Reminders */}
            {complianceDeadlines.length > 0 && (
              <div className="card-premium flex flex-col max-h-[360px]">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">Compliance Reminders</h3>
                    <p className="text-xs text-zinc-500">Upcoming Indian regulatory deadlines</p>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Calendar size={16} />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <div className="space-y-3">
                    {complianceDeadlines.map((d) => {
                      const daysUntil = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const isUrgent = daysUntil <= 7;
                      const catColors: Record<string, string> = {
                        GST: 'bg-indigo-500/10 text-indigo-400',
                        TDS: 'bg-amber-500/10 text-amber-400',
                        'Income Tax': 'bg-emerald-500/10 text-emerald-400',
                        ROC: 'bg-purple-500/10 text-purple-400',
                        'ESI/PF': 'bg-sky-500/10 text-sky-400',
                      };
                      return (
                        <Link
                          key={d.id}
                          to="/gst-compliance"
                          className={`group block rounded-xl border p-3 transition-all hover:border-white/20 ${isUrgent ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-[var(--bg-subtle)]/50'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${catColors[d.category] || 'bg-zinc-800 text-zinc-400'}`}>
                              {d.category}
                            </span>
                            <span className={`text-xs font-mono ${isUrgent ? 'text-amber-400' : 'text-zinc-500'}`}>
                              {daysUntil <= 0 ? 'Today' : `${daysUntil}d`}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">{d.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {new Date(d.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </>}

      <UploadModal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        onUpload={async (p: UploadPayload) => {
          try {
            const resp = await uploadFile(p.file);
            await refreshDocuments();
            push({ kind: 'success', title: 'Uploaded', message: resp.document.filename });
            navigate(`/document/${resp.document.id}`);
          } catch (e: any) {
            push({ kind: 'error', title: 'Upload failed', message: e?.message || 'Could not upload document' });
          }
        }}
      />
    </div>
  );
}
