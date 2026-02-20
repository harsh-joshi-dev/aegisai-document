import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2, Plus, Search, Filter, ExternalLink, Copy, CheckCircle,
  AlertTriangle, ShieldAlert, Eye, Trash2, Power, PowerOff,
  X, Loader2, FileText, Clock, ArrowUpRight, Upload, Users
} from 'lucide-react';
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

const RISK_COLORS: Record<string, string> = {
  Safe: 'bg-emerald-500/20 text-emerald-300',
  Warning: 'bg-amber-500/20 text-amber-300',
  Critical: 'bg-red-500/20 text-red-300',
};
const FOLDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-subtle text-muted',
  under_review: 'bg-blue-500/20 text-blue-300',
  verified: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-main flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20"><Link2 size={20} /></div>
            Vendor Portal
          </h1>
          <p className="text-dim mt-1 text-sm">Manage vendor links, track submissions, review documents with AI</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle text-sm text-main hover:text-main hover:border-light transition-colors">
            <Upload size={14} /> Bulk Import
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-main font-medium text-sm hover:from-indigo-600 hover:to-violet-700 transition-all shadow-lg shadow-indigo-500/20">
            <Plus size={16} /> Create Link
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Vendors', value: stats.total, icon: Users, color: 'text-indigo-400' },
          { label: 'Active Links', value: stats.active, icon: Link2, color: 'text-emerald-400' },
          { label: 'Verified', value: stats.verified, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Critical Risk', value: stats.critical, icon: ShieldAlert, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-subtle bg-card-hover p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon size={14} className={s.color} /><span className="text-xs text-dim font-medium">{s.label}</span></div>
            <p className="text-2xl font-bold text-main">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input type="text" placeholder="Search by name, PAN, GST, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${hasActiveFilters ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-subtle bg-subtle text-muted hover:text-main'}`}>
          <Filter size={14} /> Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
        </button>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-subtle bg-card-hover p-4 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-xs text-dim font-medium block mb-1.5">Link Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-subtle border border-subtle text-sm text-main focus:outline-none appearance-none">
              <option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-dim font-medium block mb-1.5">Folder Status</label>
            <select value={folderStatusFilter} onChange={e => setFolderStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-subtle border border-subtle text-sm text-main focus:outline-none appearance-none">
              <option value="">All</option><option value="pending">Pending</option><option value="under_review">Under Review</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-dim font-medium block mb-1.5">Risk Level</label>
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-subtle border border-subtle text-sm text-main focus:outline-none appearance-none">
              <option value="">All</option><option value="Safe">Safe</option><option value="Warning">Warning</option><option value="Critical">Critical</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input type="checkbox" checked={hasMissing} onChange={e => setHasMissing(e.target.checked)} className="rounded border-light bg-subtle" />
            Has missing docs
          </label>
          {hasActiveFilters && (
            <button onClick={() => { setStatusFilter(''); setFolderStatusFilter(''); setRiskFilter(''); setSearchQuery(''); setHasMissing(false); }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted hover:text-main hover:bg-subtle"><X size={12} /> Clear</button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={24} /></div>
      ) : links.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-subtle bg-card">
          <Link2 size={48} className="text-dim mx-auto mb-4" />
          <p className="text-lg font-medium text-muted mb-2">{hasActiveFilters ? 'No vendors match filters' : 'No vendor links yet'}</p>
          {!hasActiveFilters && (
            <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 font-medium text-sm hover:bg-indigo-500/30">
              <Plus size={16} /> Create First Vendor Link
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const a = parseAnalysis(link.analysis_data);
            const progress = a?.progress;
            const docCount = link.document_count ?? link.upload_count ?? 0;

            return (
              <div key={link.id} className="group rounded-xl border border-subtle bg-card-hover hover:border-subtle hover:bg-card-hover transition-all">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-base font-semibold text-main truncate cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => navigate(`/vendor-links/${link.id}`)}>
                          {link.vendor_name}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${link.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-subtle text-muted'}`}>{link.status}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${FOLDER_STATUS_COLORS[link.folder_status] || ''}`}>{FOLDER_STATUS_LABELS[link.folder_status] || link.folder_status}</span>
                        {a?.overallRiskLevel && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[a.overallRiskLevel] || ''}`}>{a.overallRiskLevel}</span>}
                        {link.is_locked && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-subtle text-muted">Locked</span>}
                        {link.template && link.template !== 'custom' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">{link.template}</span>}
                      </div>

                      {/* Progress bar */}
                      {progress && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1.5 bg-subtle rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${progress.percentage >= 100 ? 'bg-emerald-500' : progress.percentage > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${progress.percentage}%` }} />
                            </div>
                            <span className="text-xs text-muted font-medium shrink-0">{progress.uploaded}/{progress.total}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-dim">
                        <span className="flex items-center gap-1"><FileText size={12} />{docCount} doc{docCount !== 1 ? 's' : ''}</span>
                        {a?.issuesCount > 0 && <span className="flex items-center gap-1 text-amber-400"><AlertTriangle size={12} />{a.issuesCount} issue{a.issuesCount !== 1 ? 's' : ''}</span>}
                        {link.vendor_email && <span className="truncate">{link.vendor_email}</span>}
                        {link.vendor_pan && <span>PAN: {link.vendor_pan}</span>}
                        {link.vendor_gstin && <span>GST: {link.vendor_gstin}</span>}
                        <span className="flex items-center gap-1"><Clock size={12} />{new Date(link.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => copyLink(link.token, link.id)} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle" title="Copy link">
                        {copiedId === link.id ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                      <button onClick={() => navigate(`/vendor-links/${link.id}`)} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle" title="View"><Eye size={16} /></button>
                      <button onClick={() => window.open(`/vendor-portal/${link.token}`, '_blank')} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle" title="Portal"><ExternalLink size={16} /></button>
                      <button onClick={() => handleToggle(link.id, link.status)} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle" title={link.status === 'active' ? 'Deactivate' : 'Activate'}>
                        {link.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button onClick={() => handleDelete(link.id)} className="p-2 rounded-lg text-dim hover:text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  {a?.issues?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-subtle">
                      <div className="flex flex-wrap gap-1.5">
                        {a.issues.slice(0, 4).map((issue: any, idx: number) => (
                          <span key={idx} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${issue.severity === 'critical' ? 'bg-red-500/15 text-red-300' : issue.severity === 'high' ? 'bg-orange-500/15 text-orange-300' : issue.severity === 'medium' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-500/15 text-muted'
                            }`}>
                            <span className={`w-1 h-1 rounded-full ${issue.severity === 'critical' ? 'bg-red-400' : issue.severity === 'high' ? 'bg-orange-400' : issue.severity === 'medium' ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                            {issue.title.length > 40 ? issue.title.slice(0, 40) + '...' : issue.title}
                          </span>
                        ))}
                        {a.issues.length > 4 && <button onClick={() => navigate(`/vendor-links/${link.id}`)} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5">+{a.issues.length - 4} more <ArrowUpRight size={8} /></button>}
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

  // Custom documents — initialized from template, user can add/remove
  const [customDocs, setCustomDocs] = useState<Array<{ type: string; label: string; mandatory: boolean; requiresAnalysis?: boolean }>>([]);
  const [newDocLabel, setNewDocLabel] = useState('');
  const [newDocMandatory, setNewDocMandatory] = useState(true);
  const [newDocAI, setNewDocAI] = useState(true);
  const [isCustom, setIsCustom] = useState(false);

  const selectedTemplate = templates.find(t => t.id === form.template);

  const selectTemplate = (tid: string) => {
    setForm({ ...form, template: tid });
    if (tid === 'custom') {
      setIsCustom(true);
      setCustomDocs([]);
    } else {
      setIsCustom(false);
      const tmpl = templates.find(t => t.id === tid);
      setCustomDocs(tmpl?.requiredDocuments?.map(d => ({ type: d.type, label: d.label, mandatory: d.mandatory })) || []);
    }
  };

  const addDoc = () => {
    if (!newDocLabel.trim()) return;
    const type = newDocLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (customDocs.some(d => d.type === type)) return;
    setCustomDocs([...customDocs, { type, label: newDocLabel.trim(), mandatory: newDocMandatory, requiresAnalysis: newDocAI }]);
    setNewDocLabel(''); setNewDocMandatory(true); setNewDocAI(true);
  };

  const removeDoc = (type: string) => setCustomDocs(customDocs.filter(d => d.type !== type));

  // Initialize customDocs when templates load
  const templatesList = templates.length > 0
    ? templates.filter(t => t.id !== 'custom')
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-subtle bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-main">Create Vendor Upload Link</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-main block mb-1.5">Template *</label>
            <div className="flex flex-wrap gap-2">
              {templatesList.map(t => (
                <button key={t.id} type="button" onClick={() => selectTemplate(t.id)}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${form.template === t.id && !isCustom ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-subtle bg-card-hover text-muted hover:border-light'}`}>
                  {t.name}
                </button>
              ))}
              <button type="button" onClick={() => selectTemplate('custom')}
                className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${isCustom ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-subtle bg-card-hover text-muted hover:border-light'}`}>
                + Custom
              </button>
            </div>
            {selectedTemplate && !isCustom && <p className="text-xs text-dim mt-1.5">{selectedTemplate.description}</p>}
            {isCustom && <p className="text-xs text-violet-400 mt-1.5">Define your own required documents below</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-main block mb-1.5">Vendor Name *</label>
            <input type="text" value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} placeholder="e.g. Acme Corp"
              className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-main block mb-1.5">Email</label>
              <input type="email" value={form.vendorEmail} onChange={e => setForm({ ...form, vendorEmail: e.target.value })} placeholder="vendor@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            </div>
            <div>
              <label className="text-sm font-medium text-main block mb-1.5">Phone</label>
              <input type="text" value={form.vendorPhone} onChange={e => setForm({ ...form, vendorPhone: e.target.value })} placeholder="+91..."
                className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-main block mb-1.5">PAN</label>
              <input type="text" value={form.vendorPan} onChange={e => setForm({ ...form, vendorPan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
                className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 uppercase" />
            </div>
            <div>
              <label className="text-sm font-medium text-main block mb-1.5">GSTIN</label>
              <input type="text" value={form.vendorGstin} onChange={e => setForm({ ...form, vendorGstin: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" maxLength={15}
                className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 uppercase" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-main block mb-1.5">Description / Instructions</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Instructions for the vendor..." rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-main block mb-1.5">Max Uploads</label>
              <input type="number" value={form.maxUploads} onChange={e => setForm({ ...form, maxUploads: Number(e.target.value) || 50 })} min={1} max={500}
                className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            </div>
            <div>
              <label className="text-sm font-medium text-main block mb-1.5">Expires In (days)</label>
              <input type="number" value={form.expiresInDays} onChange={e => setForm({ ...form, expiresInDays: Number(e.target.value) || 30 })} min={1} max={365}
                className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            </div>
          </div>

          {/* Required Documents — editable */}
          <div>
            <label className="text-xs text-dim font-medium block mb-1.5">
              Required Documents ({isCustom ? customDocs.length : (selectedTemplate?.requiredDocuments?.length || 0)})
              {!isCustom && selectedTemplate && <button type="button" onClick={() => { setIsCustom(true); setCustomDocs(selectedTemplate.requiredDocuments.map(d => ({ type: d.type, label: d.label, mandatory: d.mandatory }))); }} className="ml-2 text-indigo-400 hover:text-indigo-300">Edit</button>}
            </label>
            {(isCustom || !selectedTemplate) ? (
              <div className="space-y-2">
                {customDocs.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-subtle bg-card-hover">
                    <span className="text-xs text-main flex-1">{d.label}</span>
                    <label className="flex items-center gap-1 text-[10px] text-dim cursor-pointer" title="Mandatory upload">
                      <input type="checkbox" checked={d.mandatory} onChange={e => { const upd = [...customDocs]; upd[i] = { ...upd[i], mandatory: e.target.checked }; setCustomDocs(upd); }} className="rounded border-light bg-subtle" />
                      Required
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-dim cursor-pointer" title="Run AI analysis on this document">
                      <input type="checkbox" checked={d.requiresAnalysis !== false} onChange={e => { const upd = [...customDocs]; upd[i] = { ...upd[i], requiresAnalysis: e.target.checked }; setCustomDocs(upd); }} className="rounded border-light bg-subtle" />
                      <span className="text-indigo-400">AI</span>
                    </label>
                    <button type="button" onClick={() => removeDoc(d.type)} className="p-1 rounded text-dim hover:text-red-400"><X size={12} /></button>
                  </div>
                ))}
                <div className="flex gap-2 items-center">
                  <input value={newDocLabel} onChange={e => setNewDocLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDoc())} placeholder="e.g. Bank Statement"
                    className="flex-1 px-3 py-2 rounded-lg bg-subtle border border-subtle text-xs text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
                  <label className="flex items-center gap-1 text-[10px] text-dim shrink-0 cursor-pointer">
                    <input type="checkbox" checked={newDocMandatory} onChange={e => setNewDocMandatory(e.target.checked)} className="rounded border-light bg-subtle" />
                    Required
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-dim shrink-0 cursor-pointer" title="Run AI analysis">
                    <input type="checkbox" checked={newDocAI} onChange={e => setNewDocAI(e.target.checked)} className="rounded border-light bg-subtle" />
                    <span className="text-indigo-400">AI</span>
                  </label>
                  <button type="button" onClick={addDoc} disabled={!newDocLabel.trim()} className="px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs disabled:opacity-30"><Plus size={12} /></button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedTemplate.requiredDocuments.map(d => (
                  <span key={d.type} className={`text-[10px] px-2 py-0.5 rounded-full ${d.mandatory ? 'bg-indigo-500/15 text-indigo-300' : 'bg-subtle text-muted'}`}>
                    {d.label} {d.mandatory && '*'}{d.requiresAnalysis !== false && <span className="text-indigo-400 ml-0.5">AI</span>}
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-subtle text-sm font-medium text-muted hover:text-main hover:bg-subtle">Cancel</button>
          <button onClick={handleCreate} disabled={creating || !form.vendorName?.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-main font-medium text-sm disabled:opacity-50">
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {creating ? 'Creating...' : 'Create Link'}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-subtle bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-main">Bulk Import Vendors</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle"><X size={18} /></button>
        </div>
        {!result ? (
          <>
            <p className="text-xs text-dim mb-3">Paste vendor data, one per line. Format: Name, Email, Phone, PAN, GSTIN (comma or tab separated)</p>
            <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full px-3 py-2 mb-3 rounded-lg bg-subtle border border-subtle text-sm text-main appearance-none">
              {templateOptions.map(t => <option key={t.id} value={t.id}>{t.name} Template</option>)}
            </select>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="Acme Corp, acme@example.com, +919876543210, ABCDE1234F&#10;Beta Inc, beta@example.com"
              className="w-full px-4 py-3 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none font-mono" />
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-subtle text-sm text-muted hover:text-main">Cancel</button>
              <button onClick={handleBulk} disabled={creating || !text.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-main text-sm font-medium disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {creating ? 'Creating...' : 'Import'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-main font-medium">{result.count} vendor link(s) created</p>
            <button onClick={onDone} className="mt-4 px-6 py-2 rounded-xl bg-indigo-500 text-main text-sm font-medium">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
