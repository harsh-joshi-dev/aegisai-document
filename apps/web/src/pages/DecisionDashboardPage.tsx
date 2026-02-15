import { useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert, UploadCloud, Activity, CheckCircle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { MetricCard } from '../ui/MetricCard';
import { RiskBadge } from '../ui/RiskBadge';
import { UploadModal } from '../ui/UploadModal';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../state/workspace';
import { useMockStore } from '../state/mockStore';
import { useToast } from '../state/toast';
import { useMockAuth } from '../state/mockAuth';

type UploadPayload = {
  name: string;
  docType: 'Invoice' | 'Bank' | 'GST' | 'Other';
  vendor?: string;
  date?: string;
};

export default function DecisionDashboardPage() {
  const [openUpload, setOpenUpload] = useState(false);
  const [onlyMyApprovals, setOnlyMyApprovals] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const { documents, activity, addDocument } = useMockStore();
  const { push } = useToast();
  const { user } = useMockAuth();
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
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/5 bg-[#0e0e11] px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-[#16161a] hover:border-white/10 transition-all select-none">
            <input
              type="checkbox"
              className="accent-indigo-500 h-4 w-4 rounded bg-zinc-800 border-zinc-700 focus:ring-offset-0 focus:ring-0 checked:bg-indigo-500 checked:border-transparent transition-colors cursor-pointer"
              checked={onlyMyApprovals}
              onChange={(e) => setOnlyMyApprovals(e.target.checked)}
            />
            <span>My Approvals</span>
          </label>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenUpload(true); }}
            className="btn-primary shadow-lg shadow-indigo-500/20"
          >
            <UploadCloud size={18} />
            Upload Document
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div onClick={() => navigate('/documents', { state: { preset: 'all' } })} className="cursor-pointer">
          <MetricCard
            title="Total Processed"
            value={metrics.total}
            helper="+12% vs last week"
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
                  <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-zinc-800/50 rounded-full" />
                  {recentActivity.map((ev) => (
                    <div key={ev.id} className="relative flex gap-4 pl-1 group">
                      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-[#0e0e11] ring-4 ring-[#0e0e11] group-hover:border-indigo-500/30 transition-colors">
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
                      className="group block rounded-xl bg-[#16161a] border border-white/5 p-4 hover:border-indigo-500/30 hover:bg-[#1c1c21] transition-all hover:shadow-lg"
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

        </div>
      </div>

      <UploadModal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        onUpload={(payload) => {
          const p = typeof payload === 'string' ? ({ name: payload, docType: 'Invoice' } as UploadPayload) : payload;
          const id = `doc-${Math.random().toString(16).slice(2)}`;
          addDocument({
            id,
            workspaceId: activeWorkspace.id,
            name: p.name,
            docType: p.docType,
            vendor: p.vendor || 'Demo Vendor',
            amount: 50000,
            riskLevel: 'Review Required',
            riskScore: 60,
            status: 'pending',
            createdBy: user?.email ?? null,
            date: new Date().toISOString(),
            gst: 'NA',
            summary: 'Uploaded document pending review.',
            issues: [],
            recommendations: [],
            mismatches: [],
            patternAlerts: [],
          });
          push({ kind: 'success', title: 'Uploaded', message: 'Document added to queue.' });
          navigate(`/document/${id}`);
        }}
      />
    </div>
  );
}
