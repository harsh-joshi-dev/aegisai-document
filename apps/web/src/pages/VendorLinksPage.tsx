import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2, Plus, Search, Filter, Copy, CheckCircle,
  AlertTriangle, ShieldAlert, Eye, Trash2, Power, PowerOff,
  X, Loader2, FileText, Clock, ArrowUpRight, Upload, Users,
  LinkIcon
} from 'lucide-react';
import { MetricCard } from '../ui/MetricCard';
import { RiskBadge } from '../ui/RiskBadge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getVendorLinks, createVendorLink, deleteVendorLink,
  deactivateVendorLink, activateVendorLink, getVendorTemplates,
  bulkCreateVendorLinks,
  type VendorLink, type CreateVendorLinkRequest, type DocumentTemplate,
} from '../api/client';

function parseAnalysis(data: any): any {
  if (!data) return null;
  const parsed = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
  return parsed && (parsed.overallRiskLevel || parsed.issues) ? parsed : null;
}

const FOLDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-800 text-zinc-500',
  under_review: 'bg-blue-500/10 text-blue-400',
  verified: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-rose-500/10 text-rose-400',
};
const FOLDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', under_review: 'Under Review', verified: 'Verified', rejected: 'Rejected',
};

export default function VendorLinksPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<VendorLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [folderStatusFilter, setFolderStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [hasMissing, setHasMissing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getVendorLinks({
        status: statusFilter || undefined,
        folderStatus: folderStatusFilter || undefined,
        search: searchQuery || undefined,
        riskLevel: riskFilter || undefined,
        hasMissing: hasMissing || undefined,
      });
      setLinks(result.vendorLinks);
    } catch (e) { console.error('Failed to fetch vendor links:', e); }
    finally { setLoading(false); }
  }, [statusFilter, folderStatusFilter, searchQuery, riskFilter, hasMissing]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);
  useEffect(() => { getVendorTemplates().then(r => setTemplates(r.templates)).catch(() => { }); }, []);

  const copyLink = useCallback((token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/vendor-portal/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this vendor link?')) return;
    try { await deleteVendorLink(id); setLinks(p => p.filter(l => l.id !== id)); } catch { }
  }, []);

  const handleToggle = useCallback(async (id: string, s: string) => {
    try {
      if (s === 'active') await deactivateVendorLink(id); else await activateVendorLink(id);
      setLinks(p => p.map(l => l.id === id ? { ...l, status: s === 'active' ? 'inactive' : 'active' } as VendorLink : l));
    } catch { }
  }, []);

  const stats = useMemo(() => ({
    total: links.length,
    active: links.filter(l => l.status === 'active').length,
    verified: links.filter(l => l.folder_status === 'verified').length,
    critical: links.filter(l => parseAnalysis(l.analysis_data)?.overallRiskLevel === 'Critical').length,
  }), [links]);

  const hasActiveFilters = statusFilter || folderStatusFilter || riskFilter || searchQuery || hasMissing;

  return (
    <div className="w-full space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10">
              <Link2 size={24} className="text-white" />
            </div>
            Vendor Portal
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
            Streamline third-party compliance, track document submissions, and mitigate vendor risks in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 bg-[var(--bg-subtle)] text-xs font-bold text-zinc-400 hover:bg-[var(--bg-card-hover)] hover:text-zinc-200 transition-all shadow-sm"
          >
            <Upload size={14} /> Bulk Import
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} /> Create Link
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Vendors" value={stats.total} icon={<Users size={20} />} color="indigo" description="All registered vendors" />
        <MetricCard title="Active Links" value={stats.active} icon={<LinkIcon size={20} />} color="sky" description="Currently active portals" />
        <MetricCard title="Verified" value={stats.verified} icon={<CheckCircle size={20} />} color="emerald" description="Passed all document checks" />
        <MetricCard title="Critical Risk" value={stats.critical} icon={<ShieldAlert size={20} />} color="rose" description="Immediate attention required" />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 relative w-full group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            placeholder="Search by name, PAN, GST, phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-[var(--bg-subtle)] border border-white/5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-[var(--bg-card-hover)] transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-xs font-bold transition-all ${hasActiveFilters
            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
            : 'border-white/5 bg-[var(--bg-subtle)] text-zinc-400 hover:text-zinc-200 hover:bg-[var(--bg-card-hover)]'
            }`}
        >
          <Filter size={14} />
          Filters {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-white/5 bg-[var(--bg-card)] p-6 flex flex-wrap gap-6 items-end shadow-xl"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Link Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="min-w-[140px] px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-white/5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Folder Status</label>
              <select value={folderStatusFilter} onChange={e => setFolderStatusFilter(e.target.value)} className="min-w-[140px] px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-white/5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                <option value="">All Folders</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Risk Level</label>
              <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="min-w-[140px] px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-white/5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                <option value="">All Risks</option>
                <option value="Safe">Safe</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <label className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--bg-subtle)] border border-white/5 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors group">
              <input type="checkbox" checked={hasMissing} onChange={e => setHasMissing(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500" />
              <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">Missing docs only</span>
            </label>
            {hasActiveFilters && (
              <button
                onClick={() => { setStatusFilter(''); setFolderStatusFilter(''); setRiskFilter(''); setSearchQuery(''); setHasMissing(false); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
              >
                <X size={14} /> Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
      ) : links.length === 0 ? (
        <div className="text-center py-24 rounded-3xl border border-dashed border-white/10 bg-[var(--bg-card)]/30 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-full bg-indigo-500/5 flex items-center justify-center mx-auto mb-6">
            <Link2 size={40} className="text-zinc-600" />
          </div>
          <p className="text-xl font-bold text-white mb-2">{hasActiveFilters ? 'No matches found' : 'No vendor links yet'}</p>
          <p className="text-sm text-zinc-500 mb-8 max-w-sm mx-auto">Try adjusting your filters or create a new link to start collecting documents.</p>
          {!hasActiveFilters && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={18} /> Create First Vendor Link
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {links.map(link => {
            const a = parseAnalysis(link.analysis_data);
            const progress = a?.progress;
            const docCount = link.document_count ?? link.upload_count ?? 0;

            return (
              <div
                key={link.id}
                className="group card-premium hover:shadow-2xl transition-all duration-500"
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h3
                          className="text-lg font-bold text-white truncate cursor-pointer hover:text-indigo-400 transition-colors font-display tracking-tight"
                          onClick={() => navigate(`/vendor-links/${link.id}`)}
                        >
                          {link.vendor_name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${link.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-500 border border-white/5'
                            }`}>
                            {link.status}
                          </span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${FOLDER_STATUS_COLORS[link.folder_status] || ''} border border-current opacity-80`}>
                            {FOLDER_STATUS_LABELS[link.folder_status] || link.folder_status}
                          </span>
                          {a?.overallRiskLevel && <RiskBadge level={a.overallRiskLevel} />}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {progress && (
                        <div className="mb-5 max-w-md">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Submission Progress</span>
                            <span className="text-xs font-bold text-indigo-400">{progress.uploaded} / {progress.total} docs</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden ring-1 ring-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress.percentage}%` }}
                              className={`h-full rounded-full transition-all ${progress.percentage >= 100
                                ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                : progress.percentage > 50
                                  ? 'bg-indigo-500'
                                  : 'bg-rose-500'
                                }`}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-zinc-500">
                        <span className="flex items-center gap-2 group-hover:text-zinc-300 transition-colors">
                          <FileText size={14} className="text-indigo-400/60" />
                          {docCount} document{docCount !== 1 ? 's' : ''}
                        </span>
                        {a?.issuesCount > 0 && (
                          <span className="flex items-center gap-2 text-rose-400">
                            <AlertTriangle size={14} className="animate-pulse" />
                            {a.issuesCount} issue{a.issuesCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {link.vendor_email && <span className="truncate flex items-center gap-2"><Clock size={14} className="text-zinc-600" /> {link.vendor_email}</span>}
                        {link.vendor_pan && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">PAN: {link.vendor_pan}</span>}
                        {link.vendor_gstin && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">GST: {link.vendor_gstin}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 lg:ml-6 group-hover:translate-x-0 lg:translate-x-2 transition-transform duration-500">
                      <button onClick={() => copyLink(link.token, link.id)} className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all" title="Copy link">
                        {copiedId === link.id ? <CheckCircle size={18} className="text-emerald-400" /> : <Copy size={18} />}
                      </button>
                      <button onClick={() => navigate(`/vendor-links/${link.id}`)} className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all" title="View"><Eye size={18} /></button>
                      <button onClick={() => handleToggle(link.id, link.status)} className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all" title={link.status === 'active' ? 'Deactivate' : 'Activate'}>
                        {link.status === 'active' ? <PowerOff size={18} /> : <Power size={18} />}
                      </button>
                      <button onClick={() => handleDelete(link.id)} className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all" title="Delete"><Trash2 size={18} /></button>
                    </div>
                  </div>

                  {a?.issues?.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <div className="flex flex-wrap gap-2">
                        {a.issues.slice(0, 5).map((issue: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${issue.severity === 'critical'
                              ? 'bg-rose-500/5 text-rose-400 border border-rose-500/10'
                              : issue.severity === 'high'
                                ? 'bg-orange-500/5 text-orange-400 border border-orange-500/10'
                                : 'bg-zinc-800 text-zinc-500 border border-white/5'
                              }`}
                          >
                            <span className={`w-1 h-1 rounded-full ${issue.severity === 'critical' ? 'bg-rose-400' : issue.severity === 'high' ? 'bg-orange-400' : 'bg-zinc-500'
                              }`} />
                            {issue.title}
                          </div>
                        ))}
                        {a.issues.length > 5 && (
                          <button
                            onClick={() => navigate(`/vendor-links/${link.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/5 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/10 transition-colors"
                          >
                            +{a.issues.length - 5} MORE <ArrowUpRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal templates={templates} onClose={() => setShowCreate(false)} onCreated={link => { setLinks(p => [link, ...p]); setShowCreate(false); copyLink(link.token, link.id); }} />}
      {showBulk && <BulkModal templates={templates} onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); fetchLinks(); }} />}
    </div>
  );
}

function CreateModal({ templates, onClose, onCreated }: { templates: DocumentTemplate[]; onClose: () => void; onCreated: (l: VendorLink) => void }) {
  const [form, setForm] = useState<CreateVendorLinkRequest>({ vendorName: '', vendorEmail: '', vendorPhone: '', vendorPan: '', vendorGstin: '', description: '', maxUploads: 50, expiresInDays: 30, template: 'vendor' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable required documents list (starts with mandatory docs from selected template)
  const [customDocs, setCustomDocs] = useState<Array<{ type: string; label: string; mandatory: boolean; requiresAnalysis?: boolean }>>([]);
  const [newDocLabel, setNewDocLabel] = useState('');
  const [newDocMandatory, setNewDocMandatory] = useState(true);
  const [newDocAI, setNewDocAI] = useState(true);
  const [isEditingDocs, setIsEditingDocs] = useState(false);

  const selectedTemplate = templates.find(t => t.id === form.template);

  const getTemplateMandatoryDocs = useCallback((tid: string) => {
    const tmpl = templates.find(t => t.id === tid);
    const source = tmpl?.requiredDocuments || [];
    const mandatoryOnly = source.filter(d => d.mandatory);
    const baseline = mandatoryOnly.length > 0 ? mandatoryOnly : source;
    return baseline.map(d => ({ type: d.type, label: d.label, mandatory: d.mandatory !== false, requiresAnalysis: d.requiresAnalysis }));
  }, [templates]);

  const selectTemplate = (tid: string) => {
    setForm({ ...form, template: tid });
    setCustomDocs(getTemplateMandatoryDocs(tid));
    setIsEditingDocs(false);
  };

  const addDoc = () => {
    if (!newDocLabel.trim()) return;
    const type = newDocLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (customDocs.some(d => d.type === type)) return;
    setCustomDocs([...customDocs, { type, label: newDocLabel.trim(), mandatory: newDocMandatory, requiresAnalysis: newDocAI }]);
    setNewDocLabel(''); setNewDocMandatory(true); setNewDocAI(true);
  };

  const removeDoc = (type: string) => setCustomDocs(customDocs.filter(d => d.type !== type));

  // Initialize docs when templates load
  useEffect(() => {
    if (templates.length === 0) return;
    setCustomDocs(prev => prev.length > 0 ? prev : getTemplateMandatoryDocs(form.template || 'vendor'));
  }, [templates, form.template, getTemplateMandatoryDocs]);

  const templatesList = templates.length > 0
    ? templates
    : [{ id: 'vendor', name: 'Vendor', description: '', requiredDocuments: [] }, { id: 'contractor', name: 'Contractor', description: '', requiredDocuments: [] }, { id: 'employee', name: 'Employee', description: '', requiredDocuments: [] }] as DocumentTemplate[];

  const handleCreate = async () => {
    if (!form.vendorName?.trim()) { setError('Vendor name is required'); return; }
    setCreating(true); setError(null);
    try {
      const payload = { ...form, customRequiredDocuments: customDocs.length > 0 ? customDocs : undefined };
      const r = await createVendorLink(payload);
      onCreated(r.vendorLink);
    } catch (e: any) { setError(e?.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/5 bg-[var(--bg-modal)] p-8 lg:p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />

        <div className="flex items-center justify-between mb-8 relative">
          <div>
            <h3 className="text-2xl font-bold text-white font-display tracking-tight">Create Vendor Portal</h3>
            <p className="text-xs text-zinc-500 mt-1 font-medium">Issue a secure link for document collection</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"><X size={20} /></button>
        </div>

        <div className="space-y-6 relative">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Select Template</label>
            <div className="flex flex-wrap gap-2">
              {templatesList.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t.id)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${form.template === t.id
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                    : 'border-white/5 bg-[var(--bg-subtle)] text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                    }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Client Name *</label>
              <input
                type="text"
                value={form.vendorName}
                onChange={e => setForm({ ...form, vendorName: e.target.value })}
                placeholder="Acme Client Pvt Ltd"
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-subtle)] border border-white/5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-[var(--bg-card-hover)] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Contact Email</label>
              <input
                type="email"
                value={form.vendorEmail}
                onChange={e => setForm({ ...form, vendorEmail: e.target.value })}
                placeholder="legal@acme.com"
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-subtle)] border border-white/5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-[var(--bg-card-hover)] transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Required Documents</label>
            <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-white/5 space-y-4">
              {isEditingDocs ? (
                <>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                    {customDocs.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 group/item">
                        <span className="text-xs font-bold text-zinc-300 flex-1">{d.label}</span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={d.mandatory} onChange={e => { const upd = [...customDocs]; upd[i] = { ...upd[i], mandatory: e.target.checked }; setCustomDocs(upd); }} className="rounded border-zinc-700 bg-zinc-800 text-indigo-500" />
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Required</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={d.requiresAnalysis !== false} onChange={e => { const upd = [...customDocs]; upd[i] = { ...upd[i], requiresAnalysis: e.target.checked }; setCustomDocs(upd); }} className="rounded border-zinc-700 bg-zinc-800 text-indigo-500" />
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest shadow-sm shadow-indigo-500/10">AI</span>
                          </label>
                          <button type="button" onClick={() => removeDoc(d.type)} className="p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover/item:opacity-100"><X size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 p-2 rounded-xl bg-black/20 border border-white/5">
                    <input
                      value={newDocLabel}
                      onChange={e => setNewDocLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDoc())}
                      placeholder="Add Document Name..."
                      className="flex-1 bg-transparent px-2 py-1 text-xs text-white focus:outline-none placeholder-zinc-700"
                    />
                    <button type="button" onClick={addDoc} disabled={!newDocLabel.trim()} className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-30 transition-all"><Plus size={16} /></button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditingDocs(false)}
                      className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {customDocs.map(d => (
                    <div key={d.type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10 group">
                      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{d.label} {d.mandatory && '*'}</span>
                      {d.requiresAnalysis !== false && <span className="w-1 h-1 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />}
                    </div>
                  ))}
                  {customDocs.length === 0 && (
                    <span className="text-[11px] text-zinc-500">No required documents selected.</span>
                  )}
                  <button type="button" onClick={() => setIsEditingDocs(true)} className="text-[10px] font-black text-zinc-500 hover:text-zinc-300 uppercase tracking-widest ml-1 transition-colors">Edit List</button>
                </div>
              )}
            </div>
          </div>

          {error && <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/10 rounded-xl px-4 py-3">{error}</motion.p>}
        </div>

        <div className="flex gap-4 mt-10 relative">
          <button onClick={onClose} className="flex-1 px-6 py-3.5 rounded-2xl border border-white/5 bg-[var(--bg-subtle)] text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-[var(--bg-card-hover)] transition-all">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={creating || !form.vendorName?.trim()}
            className="flex-1 btn-primary shadow-xl shadow-indigo-500/20 disabled:opacity-50 h-[48px]"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {creating ? 'CREATING...' : 'CREATE PORTAL'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkModal({ templates: _templates, onClose, onDone }: { templates: DocumentTemplate[]; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [template, setTemplate] = useState('vendor');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleBulk = async () => {
    const lines = text.split('\n').filter(l => l.trim());
    const vendors = lines.map(l => {
      const parts = l.split(/[,\t]+/).map(p => p.trim());
      return { name: parts[0], email: parts[1] || undefined, phone: parts[2] || undefined, pan: parts[3] || undefined, gstin: parts[4] || undefined };
    }).filter(v => v.name);

    if (vendors.length === 0) return;
    setCreating(true);
    try {
      const r = await bulkCreateVendorLinks(vendors, template, 30);
      setResult(r);
    } catch { }
    finally { setCreating(false); }
  };

  const templateOptions = _templates.length > 0
    ? _templates.filter(t => t.id !== 'custom')
    : [{ id: 'vendor', name: 'Vendor' }, { id: 'contractor', name: 'Contractor' }, { id: 'employee', name: 'Employee' }];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg rounded-[32px] border border-white/5 bg-[var(--bg-modal)] p-8 lg:p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative">
        <div className="flex items-center justify-between mb-8 relative">
          <div>
            <h3 className="text-2xl font-bold text-white font-display tracking-tight">Bulk Import</h3>
            <p className="text-xs text-zinc-500 mt-1 font-medium">Create multiple vendor portals at once</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"><X size={20} /></button>
        </div>

        {!result ? (
          <div className="space-y-6 relative">
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Standard Format</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">Name, Email, Phone, PAN, GSTIN (Comma or Tab separated)</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Apply Template</label>
              <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-subtle)] border border-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                {templateOptions.map(t => <option key={t.id} value={t.id}>{t.name} Template</option>)}
              </select>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              placeholder="Acme Corp, acme@example.com, +919876543210..."
              className="w-full px-4 py-4 rounded-xl bg-[var(--bg-subtle)] border border-white/5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-mono"
            />

            <div className="flex gap-4 mt-8">
              <button onClick={onClose} className="flex-1 px-6 py-3.5 rounded-2xl border border-white/5 bg-[var(--bg-subtle)] text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">Cancel</button>
              <button onClick={handleBulk} disabled={creating || !text.trim()} className="flex-1 btn-primary shadow-xl shadow-indigo-500/20 disabled:opacity-50">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {creating ? 'IMPORTING...' : 'START IMPORT'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-white mb-2">{result.count} Vendor links created</p>
            <p className="text-sm text-zinc-500 mb-8">Successfully processed your bulk import list.</p>
            <button onClick={onDone} className="btn-primary w-full max-w-[200px] mx-auto">CONTINUE</button>
          </div>
        )}
      </div>
    </div>
  );
}
