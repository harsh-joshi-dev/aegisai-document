import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  FileText,
  AlertCircle,
  ShieldCheck,
  Activity,
  Clock,
  ArrowRight,
  Trash2,
  ExternalLink,
  ChevronRight,
  Layers
} from 'lucide-react';
import { deleteDocument, getDocuments, type Document } from '../api/client';
import { MetricCard } from '../ui/MetricCard';
import { RiskBadge } from '../ui/RiskBadge';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getDocuments();
      setDocuments(r.documents ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (doc: Document) => {
    const ok = window.confirm(`Delete "${doc.filename}"? This will remove the document and its processed chunks.`);
    if (!ok) return;
    try {
      await deleteDocument(doc.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete document');
    }
  };

  const dashboardData = useMemo(() => {
    const critical = documents.filter((d) => d.riskLevel === 'Critical').length;
    const warning = documents.filter((d) => d.riskLevel === 'Warning').length;
    const safe = documents.filter((d) => d.riskLevel === 'Normal').length;
    const avgRiskScore = documents.length
      ? Math.round(
        documents.reduce((acc, d) => acc + (typeof d.riskScore === 'number' ? d.riskScore : 0), 0) / documents.length
      )
      : 0;

    const filtered = documents.filter(d =>
      d.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return { critical, warning, safe, avgRiskScore, filtered };
  }, [documents, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-vh-screen py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-dim font-bold uppercase tracking-widest text-[10px]">Initializing Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-main tracking-tight mb-2 font-display">
            Executive <span className="text-indigo-400">Overview</span>
          </h1>
          <p className="text-dim font-medium">Real-time risk monitoring and document intelligence.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary px-5 py-2.5 h-11 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
            <Filter size={16} />
            Filters
          </button>
          <Link to="/upload" className="btn-primary-xl px-6 py-2.5 h-11 flex items-center gap-2 font-bold text-xs uppercase tracking-wider shadow-indigo-500/20">
            <Plus size={18} />
            Analyze New
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Risk Index"
          value={dashboardData.avgRiskScore}
          description="Average cluster safety score"
          icon={<Activity size={20} />}
          trend={{ value: '12%', positive: false }}
          color="indigo"
        />
        <MetricCard
          title="Critical Flags"
          value={dashboardData.critical}
          description="Immediate action required"
          icon={<AlertCircle size={20} />}
          color="rose"
        />
        <MetricCard
          title="Pending Review"
          value={dashboardData.warning}
          description="High-risk anomalies detected"
          icon={<Clock size={20} />}
          color="amber"
        />
        <MetricCard
          title="Safe Documents"
          value={dashboardData.safe}
          description="Verified with no anomalies"
          icon={<ShieldCheck size={20} />}
          color="emerald"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Document List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display flex items-center gap-3 text-main">
              Recent Analysis
              <span className="px-2 py-0.5 rounded-lg bg-subtle border border-subtle text-[10px] text-dim">{documents.length}</span>
            </h2>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repository..."
                className="bg-subtle border border-subtle rounded-xl pl-10 pr-4 py-2 text-sm text-main placeholder-dim focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all w-64"
              />
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {dashboardData.filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-3xl border border-dashed border-subtle p-20 text-center"
                >
                  <div className="w-16 h-16 bg-subtle rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Layers className="text-dim" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-main mb-2">No documents found</h3>
                  <p className="text-sm text-dim mb-6">Start by uploading your first document for analysis.</p>
                  <Link to="/upload" className="btn-primary px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider">
                    Upload Now
                  </Link>
                </motion.div>
              ) : (
                dashboardData.filtered.slice(0, 10).map((doc, idx) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={doc.id}
                    className="group relative flex items-center justify-between p-4 rounded-2xl bg-card border border-subtle hover:border-subtle hover:bg-card-hover transition-all cursor-pointer overflow-hidden shadow-sm"
                  >
                    {/* Progress Bar Background */}
                    <div
                      className="absolute bottom-0 left-0 h-[2px] bg-indigo-500/20 transition-all duration-1000"
                      style={{ width: `${doc.riskScore}%` }}
                    />

                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`p-3 rounded-xl bg-subtle border border-subtle group-hover:scale-110 transition-transform duration-500 ${doc.riskLevel === 'Critical' ? 'text-rose-400' : 'text-muted'}`}>
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-main group-hover:text-main transition-colors truncate">{doc.filename}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-dim font-bold uppercase tracking-widest flex items-center gap-1.5">
                            <Clock size={10} />
                            {new Date().toLocaleDateString()}
                          </span>
                          <div className="w-1 h-1 rounded-full bg-subtle" />
                          <span className="text-[10px] text-dim font-bold uppercase tracking-widest">
                            Score: {doc.riskScore || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block">
                        <RiskBadge level={doc.riskLevel as any} />
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/document/${doc.id}`}
                          className="p-2 rounded-lg bg-subtle text-muted hover:text-main hover:bg-indigo-500/20 transition-all"
                        >
                          <ArrowRight size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-2 rounded-lg bg-subtle text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <button className="text-dim p-1 group-hover:text-muted">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>

            {dashboardData.filtered.length > 10 && (
              <button className="w-full py-4 text-xs font-bold uppercase tracking-widest text-dim hover:text-main transition-colors flex items-center justify-center gap-2 group">
                View All Intelligence
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-8">
          {/* Intelligence Score */}
          <div className="rounded-3xl bg-indigo-600 p-8 shadow-2xl shadow-indigo-600/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700">
              <ShieldCheck size={120} />
            </div>
            <div className="relative z-10">
              <h3 className="text-indigo-100 font-bold uppercase tracking-[0.2em] text-[10px] mb-6">Security Posture</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-extrabold text-main font-display">94</span>
                <span className="text-xl text-indigo-300 font-bold">/100</span>
              </div>
              <p className="text-indigo-200 text-sm font-medium leading-relaxed mb-6">
                Your enterprise risk profile is <span className="text-main font-bold">Strong</span>. No major anomalies detected in the last 24 hours.
              </p>
              <button className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-50 transition-all">
                Download Report
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-3xl bg-card border border-subtle p-8">
            <h3 className="text-xs font-bold text-dim uppercase tracking-widest mb-6">Platform Insights</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-card-hover transition-all group cursor-pointer">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-main">KYC Verified</h4>
                  <p className="text-xs text-dim mt-1">12 new vendors successfully screened today.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-card-hover transition-all group cursor-pointer">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                  <ExternalLink size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-main">Rule Updates</h4>
                  <p className="text-xs text-dim mt-1">Audit engine updated with 4 new compliance metrics.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
