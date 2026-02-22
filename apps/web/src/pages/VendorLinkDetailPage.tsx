import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, CheckCircle, AlertTriangle,
  FileText, Loader2, Brain, ChevronRight, Search, X, AlertCircle, Info,
  Shield, TrendingDown, Eye, Lock, Unlock, Send, MessageSquare, Clock,
  Download, CheckSquare, XSquare, RotateCcw, Plus, IndianRupee
} from 'lucide-react';
import {
  getVendorLinkDetail, analyzeVendorLink, reviewVendorLink,
  reviewVendorDocument, addVendorComment, lockVendorFolder,
  unlockVendorFolder, sendVendorReminder, getVendorAuditReport,
  updateVendorRequiredDocuments, reprocessVendorDocuments,
  type VendorLink, type VendorComment, type VendorActivity,
} from '../api/client';
import VendorFinancialsTab from './VendorFinancialsTab';

type Tab = 'issues' | 'documents' | 'financials' | 'required' | 'comments' | 'audit';

const SEV_COLORS: Record<string, string> = { critical: 'bg-red-500/20 text-red-300', high: 'bg-orange-500/20 text-orange-300', medium: 'bg-amber-500/20 text-amber-300', low: 'bg-subtle text-muted' };
const SEV_DOT: Record<string, string> = { critical: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-amber-400', low: 'bg-muted' };
const CAT_COLORS: Record<string, string> = { missing: 'bg-rose-500/20 text-rose-300', mismatch: 'bg-purple-500/20 text-purple-300', format_error: 'bg-orange-500/20 text-orange-300', fraud: 'bg-red-500/20 text-red-300', warning: 'bg-amber-500/20 text-amber-300', suggestion: 'bg-blue-500/20 text-blue-300' };
const CAT_LABELS: Record<string, string> = { missing: 'Missing', mismatch: 'Mismatch', format_error: 'Format Error', fraud: 'Fraud', warning: 'Warning', suggestion: 'Suggestion' };
const FS_COLORS: Record<string, string> = { pending: 'text-muted', under_review: 'text-blue-300', verified: 'text-emerald-300', rejected: 'text-red-300' };
const FS_LABELS: Record<string, string> = { pending: 'Pending', under_review: 'Under Review', verified: 'Verified', rejected: 'Rejected' };

export default function VendorLinkDetailPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<VendorLink | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [comments, setComments] = useState<VendorComment[]>([]);
  const [activity, setActivity] = useState<VendorActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState<Tab>('issues');
  const [copiedLink, setCopiedLink] = useState(false);

  // Filters
  const [issueSearch, setIssueSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  // Review
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Doc review
  const [docReviewId, setDocReviewId] = useState<string | null>(null);
  const [docReviewStatus, setDocReviewStatus] = useState('');
  const [docReviewNotes, setDocReviewNotes] = useState('');

  // Comment
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);

  // Preview
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  // Required docs editing
  const [editingReqDocs, setEditingReqDocs] = useState(false);
  const [reqDocs, setReqDocs] = useState<any[]>([]);
  const [newDocLabel, setNewDocLabel] = useState('');
  const [newDocMandatory, setNewDocMandatory] = useState(true);
  const [newDocAI, setNewDocAI] = useState(true);
  const [savingReqDocs, setSavingReqDocs] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!linkId) return;
    try {
      setLoading(true);
      const r = await getVendorLinkDetail(linkId);
      setLink(r.vendorLink);
      setDocuments(r.documents);
      setComments(r.comments || []);
      setActivity(r.activity || []);
    } catch { }
    finally { setLoading(false); }
  }, [linkId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleAnalyze = async () => {
    if (!linkId) return;
    setAnalyzing(true);
    try {
      const r = await analyzeVendorLink(linkId);
      setLink(prev => prev ? { ...prev, analysis_data: r.analysis, analyzed_at: new Date().toISOString() } : prev);
    } catch { }
    finally { setAnalyzing(false); }
  };

  const [reprocessing, setReprocessing] = useState(false);
  const handleReprocess = async () => {
    if (!linkId) return;
    setReprocessing(true);
    try {
      const r = await reprocessVendorDocuments(linkId);
      alert(`Re-processed ${r.documentsReprocessed} documents with updated AI. Reloading...`);
      window.location.reload();
    } catch { alert('Reprocessing failed'); }
    finally { setReprocessing(false); }
  };

  const handleReview = async () => {
    if (!linkId || !reviewStatus) return;
    setReviewing(true);
    try {
      await reviewVendorLink(linkId, reviewStatus, reviewNotes);
      setLink(prev => prev ? { ...prev, folder_status: reviewStatus as any } : prev);
      setShowReviewModal(false); setReviewNotes('');
    } catch { }
    finally { setReviewing(false); }
  };

  const handleDocReview = async (docId: string) => {
    if (!linkId || !docReviewStatus) return;
    try {
      await reviewVendorDocument(linkId, docId, docReviewStatus, docReviewNotes);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, review_status: docReviewStatus, review_notes: docReviewNotes } : d));
      setDocReviewId(null); setDocReviewStatus(''); setDocReviewNotes('');
    } catch { }
  };

  const handleComment = async () => {
    if (!linkId || !newComment.trim()) return;
    setCommenting(true);
    try {
      const r = await addVendorComment(linkId, newComment);
      setComments(prev => [r.comment, ...prev]);
      setNewComment('');
    } catch { }
    finally { setCommenting(false); }
  };

  const handleLockToggle = async () => {
    if (!linkId || !link) return;
    try {
      if (link.is_locked) await unlockVendorFolder(linkId); else await lockVendorFolder(linkId);
      setLink(prev => prev ? { ...prev, is_locked: !prev.is_locked } : prev);
    } catch { }
  };

  const handleReminder = async () => {
    if (!linkId) return;
    try {
      const r = await sendVendorReminder(linkId);
      alert(r.emailSent ? 'Reminder email sent!' : `Reminder logged. ${r.missingDocuments?.length || 0} missing docs.`);
    } catch { }
  };

  const handleDownloadReport = async () => {
    if (!linkId) return;
    try {
      const r = await getVendorAuditReport(linkId);
      const blob = new Blob([JSON.stringify(r.report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `vendor-report-${link?.vendor_name || 'report'}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch { }
  };

  const startEditReqDocs = () => {
    const current = Array.isArray(link?.required_documents) ? link!.required_documents
      : (typeof link?.required_documents === 'string' ? JSON.parse(link!.required_documents || '[]') : []);
    setReqDocs([...current]);
    setEditingReqDocs(true);
  };

  const addReqDoc = () => {
    if (!newDocLabel.trim()) return;
    const type = newDocLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (reqDocs.some(d => d.type === type)) return;
    setReqDocs([...reqDocs, { type, label: newDocLabel.trim(), mandatory: newDocMandatory, requiresAnalysis: newDocAI }]);
    setNewDocLabel(''); setNewDocMandatory(true); setNewDocAI(true);
  };

  const removeReqDoc = (type: string) => {
    setReqDocs(reqDocs.filter(d => d.type !== type));
  };

  const saveReqDocs = async () => {
    if (!linkId) return;
    setSavingReqDocs(true);
    try {
      await updateVendorRequiredDocuments(linkId, reqDocs);
      setLink(prev => prev ? { ...prev, required_documents: reqDocs } : prev);
      setEditingReqDocs(false);
    } catch { }
    finally { setSavingReqDocs(false); }
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(`${window.location.origin}/vendor-portal/${link.token}`);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>;
  if (!link) return <div className="text-center py-32 text-dim">Vendor link not found</div>;

  // Parse analysis_data (may be string from PostgreSQL or already an object)
  let parsedAnalysis: any = null;
  if (link.analysis_data) {
    if (typeof link.analysis_data === 'string') {
      try { parsedAnalysis = JSON.parse(link.analysis_data); } catch { parsedAnalysis = null; }
    } else {
      parsedAnalysis = link.analysis_data;
    }
  }
  const analysis = parsedAnalysis && (parsedAnalysis.overallRiskLevel || parsedAnalysis.issues) ? parsedAnalysis : null;
  const issues = analysis?.issues || [];
  const progress = analysis?.progress;
  const missing = analysis?.missingDocuments || [];

  const filteredIssues = issues.filter((i: any) => {
    if (sevFilter && i.severity !== sevFilter) return false;
    if (catFilter && i.category !== catFilter) return false;
    if (issueSearch && !i.title.toLowerCase().includes(issueSearch.toLowerCase()) && !i.description.toLowerCase().includes(issueSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/vendor-links')} className="flex items-center gap-1 text-sm text-dim hover:text-main mb-2"><ArrowLeft size={14} />Back to Vendors</button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-main">{link.vendor_name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${link.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/20 text-muted'}`}>{link.status}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${FS_COLORS[link.folder_status] ? `bg-${link.folder_status === 'verified' ? 'emerald' : link.folder_status === 'rejected' ? 'red' : link.folder_status === 'under_review' ? 'blue' : 'zinc'}-500/20 ${FS_COLORS[link.folder_status]}` : 'bg-zinc-500/20 text-muted'}`}>{FS_LABELS[link.folder_status] || link.folder_status}</span>
            {link.is_locked && <span className="text-xs px-2 py-1 rounded-full bg-zinc-500/20 text-muted flex items-center gap-1"><Lock size={10} /> Locked</span>}
            {link.template && <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-300">{link.template}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-dim mt-2">
            {link.vendor_email && <span>{link.vendor_email}</span>}
            {link.vendor_pan && <span>PAN: {link.vendor_pan}</span>}
            {link.vendor_gstin && <span>GST: {link.vendor_gstin}</span>}
            {link.vendor_phone && <span>Phone: {link.vendor_phone}</span>}
            <span>Created: {new Date(link.created_at).toLocaleDateString()}</span>
            {link.analyzed_at && <span>Last analyzed: {new Date(link.analyzed_at).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-subtle text-xs text-muted hover:text-main">
            {copiedLink ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />} {copiedLink ? 'Copied' : 'Copy Link'}
          </button>
          <button onClick={handleReminder} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-subtle text-xs text-muted hover:text-main"><Send size={13} /> Remind</button>
          <button onClick={handleLockToggle} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-subtle text-xs text-muted hover:text-main">
            {link.is_locked ? <><Unlock size={13} /> Unlock</> : <><Lock size={13} /> Lock</>}
          </button>
          <button onClick={() => setShowReviewModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300"><CheckSquare size={13} /> Review</button>
          <button onClick={handleReprocess} disabled={reprocessing} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 disabled:opacity-50">
            {reprocessing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} {reprocessing ? 'Re-processing...' : 'Re-process Docs'}
          </button>
          <button onClick={handleAnalyze} disabled={analyzing} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 ${analysis ? 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-main shadow-lg shadow-indigo-500/20'}`}>
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />} {analyzing ? 'Analyzing...' : analysis ? 'Re-run Analysis' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Score Cards */}
      {analysis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <ScoreCard label="Risk Score" value={analysis.overallRiskScore} suffix="/100" color={analysis.overallRiskScore >= 70 ? 'emerald' : analysis.overallRiskScore >= 40 ? 'amber' : 'red'} icon={Shield} />
          <ScoreCard label="Health" value={analysis.vendorHealthScore} suffix="/100" color={analysis.vendorHealthScore >= 70 ? 'emerald' : 'amber'} icon={TrendingDown} />
          <ScoreCard label="Documents" value={analysis.totalDocuments} color="indigo" icon={FileText} />
          <ScoreCard label="Issues" value={analysis.issuesCount} color={analysis.issuesCount > 0 ? 'amber' : 'emerald'} icon={AlertTriangle} />
          <div className="rounded-xl p-4 transition-all duration-200 hover:translate-y-[-2px]"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', boxShadow: '0 4px 16px rgba(59,130,246,0.08)' }}>
            <div className="flex items-center gap-2 mb-1"><Clock size={14} style={{ color: '#60a5fa' }} /><span className="text-xs text-dim font-medium">Progress</span></div>
            <p className="text-xl font-bold text-main">{progress?.percentage ?? 0}%</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress?.percentage ?? 0}%`, background: (progress?.percentage ?? 0) >= 100 ? '#10b981' : '#6366f1' }} />
              </div>
              <span className="text-[10px] text-dim">{progress?.uploaded ?? 0}/{progress?.total ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Missing docs */}
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h4 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-2"><AlertCircle size={14} /> Missing Documents ({missing.length})</h4>
          <div className="flex flex-wrap gap-2">
            {missing.map((m: any, i: number) => (
              <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${m.mandatory ? 'bg-red-500/15 text-red-300 border border-red-500/20' : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'}`}>
                {m.label} {m.mandatory && <span className="text-red-400">*</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category summary */}
      {analysis?.categories && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(analysis.categories as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => (
            <button key={k} onClick={() => { setCatFilter(catFilter === k ? '' : k); setTab('issues'); }} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${catFilter === k ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-subtle bg-card-hover hover:bg-card-hover'} ${CAT_COLORS[k] || 'text-main'}`}>
              {CAT_LABELS[k] || k}: {v}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-subtle pb-0 overflow-x-auto">
        {([['issues', 'Issues', AlertTriangle], ['financials', 'Financials', IndianRupee], ['documents', 'Documents', FileText], ['required', 'Required Docs', Shield], ['comments', 'Comments', MessageSquare], ['audit', 'Audit Trail', Clock]] as [string, string, any][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as Tab)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors whitespace-nowrap ${tab === key ? 'text-indigo-300 border-indigo-500' : 'text-dim border-transparent hover:text-main'}`}>
            <Icon size={14} /> {label}
            {key === 'issues' && issues.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{issues.length}</span>}
            {key === 'comments' && comments.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{comments.length}</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button onClick={handleDownloadReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle text-xs text-muted hover:text-main"><Download size={12} /> Report</button>
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'issues' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input value={issueSearch} onChange={e => setIssueSearch(e.target.value)} placeholder="Search issues..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-subtle border border-subtle text-xs text-main placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            </div>
            <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-subtle border border-subtle text-xs text-main appearance-none">
              <option value="">All Severity</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-subtle border border-subtle text-xs text-main appearance-none">
              <option value="">All Categories</option><option value="missing">Missing</option><option value="mismatch">Mismatch</option><option value="format_error">Format Error</option><option value="fraud">Fraud</option><option value="warning">Warning</option><option value="suggestion">Suggestion</option>
            </select>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="text-center py-12 text-dim">
              {issues.length === 0 ? <><Info size={32} className="mx-auto mb-2" /><p className="text-sm">No issues found. Run analysis to detect issues.</p></> : <p className="text-sm">No issues match the current filters.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredIssues.map((issue: any) => (
                <div key={issue.id} className="rounded-xl border border-subtle bg-card-hover hover:bg-card-hover transition-all">
                  <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)} className="w-full p-4 flex items-start gap-3 text-left">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEV_DOT[issue.severity] || ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium text-main">{issue.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SEV_COLORS[issue.severity] || ''}`}>{issue.severity}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CAT_COLORS[issue.category] || ''}`}>{CAT_LABELS[issue.category] || issue.category}</span>
                        {issue.autoDetected && <span className="text-[10px] text-dim">Auto-detected</span>}
                        <span className="text-[10px] text-dim ml-auto shrink-0">+{issue.riskPoints} pts</span>
                      </div>
                      <p className="text-xs text-dim line-clamp-1">{issue.description}</p>
                    </div>
                    <ChevronRight size={14} className={`text-dim transition-transform mt-1 ${expandedIssue === issue.id ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedIssue === issue.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-subtle animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="pl-5 space-y-3">
                        <p className="text-xs text-muted leading-relaxed">{issue.description}</p>
                        {issue.affectedDocumentNames?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-dim font-medium uppercase tracking-wider mb-1">Affected Documents</p>
                            <div className="flex flex-wrap gap-1">{issue.affectedDocumentNames.map((n: string, i: number) => <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-subtle text-muted">{n}</span>)}</div>
                          </div>
                        )}
                        <div className="flex items-start gap-2 bg-indigo-500/5 rounded-lg p-3 border border-indigo-500/10">
                          <Info size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-indigo-300">{issue.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'financials' && link && (
        <VendorFinancialsTab linkId={link.id} vendorName={link.vendor_name} />
      )}

      {tab === 'documents' && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-dim"><FileText size={32} className="mx-auto mb-2" /><p className="text-sm">No documents uploaded yet.</p></div>
          ) : documents.map(doc => (
            <div key={doc.id} className="rounded-xl border border-subtle bg-card-hover p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-subtle flex items-center justify-center shrink-0">
                <FileText size={18} className="text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-main truncate">{doc.filename}</span>
                  {doc.risk_level && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${doc.risk_level === 'Critical' ? 'bg-red-500/20 text-red-300' : doc.risk_level === 'Warning' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{doc.risk_level}</span>}
                  {doc.review_status && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${doc.review_status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : doc.review_status === 'rejected' ? 'bg-red-500/20 text-red-300' : doc.review_status === 'needs_reupload' ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-500/20 text-muted'}`}>{doc.review_status}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-dim">
                  <span>{new Date(doc.uploaded_at).toLocaleString()}</span>
                  {doc.risk_score != null && <span>Risk: {doc.risk_score}</span>}
                  {doc.file_type && <span>{doc.file_type}</span>}
                </div>
                {doc.summary && <p className="text-xs text-dim mt-1 line-clamp-1">{doc.summary}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {doc.file_type?.includes('pdf') && (
                  <button onClick={() => setPreviewDoc(doc)} className="p-2 rounded-lg text-dim hover:text-main hover:bg-subtle" title="Preview"><Eye size={14} /></button>
                )}
                {docReviewId === doc.id ? (
                  <div className="flex items-center gap-1 bg-subtle rounded-lg p-1">
                    <select value={docReviewStatus} onChange={e => setDocReviewStatus(e.target.value)} className="px-2 py-1 rounded text-[10px] bg-transparent border border-subtle text-main appearance-none">
                      <option value="">Status</option><option value="approved">Approve</option><option value="rejected">Reject</option><option value="needs_reupload">Re-upload</option>
                    </select>
                    <input value={docReviewNotes} onChange={e => setDocReviewNotes(e.target.value)} placeholder="Notes..." className="px-2 py-1 w-24 rounded text-[10px] bg-transparent border border-subtle text-main placeholder-zinc-600" />
                    <button onClick={() => handleDocReview(doc.id)} disabled={!docReviewStatus} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30"><CheckCircle size={14} /></button>
                    <button onClick={() => setDocReviewId(null)} className="p-1 rounded text-dim hover:bg-subtle"><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setDocReviewId(doc.id)} className="p-2 rounded-lg text-dim hover:text-indigo-300 hover:bg-indigo-500/10" title="Review"><CheckSquare size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} placeholder="Add a note or comment..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            <button onClick={handleComment} disabled={commenting || !newComment.trim()} className="px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium disabled:opacity-50">
              {commenting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </div>
          {comments.length === 0 ? (
            <div className="text-center py-12 text-dim"><MessageSquare size={32} className="mx-auto mb-2" /><p className="text-sm">No comments yet.</p></div>
          ) : comments.map(c => (
            <div key={c.id} className="rounded-xl border border-subtle bg-card-hover p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">{(c.user_name || 'U')[0]}</div>
                <span className="text-sm font-medium text-main">{c.user_name || c.user_email || 'User'}</span>
                <span className="text-xs text-dim">{new Date(c.created_at).toLocaleString()}</span>
                {c.comment_type && c.comment_type !== 'note' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-muted">{c.comment_type}</span>}
              </div>
              <p className="text-sm text-main pl-9">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'required' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-main">Required Documents ({(Array.isArray(link.required_documents) ? link.required_documents : []).length})</h3>
            {!editingReqDocs ? (
              <button onClick={startEditReqDocs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle text-xs text-muted hover:text-main">Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditingReqDocs(false)} className="px-3 py-1.5 rounded-lg border border-subtle text-xs text-muted">Cancel</button>
                <button onClick={saveReqDocs} disabled={savingReqDocs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-xs text-indigo-300 disabled:opacity-50">
                  {savingReqDocs ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Save
                </button>
              </div>
            )}
          </div>

          {editingReqDocs ? (
            <div className="space-y-3">
              {reqDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-subtle bg-card-hover">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-main">{doc.label}</span>
                    {doc.mandatory && <span className="text-red-400 ml-1 text-xs">*</span>}
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-dim cursor-pointer">
                    <input type="checkbox" checked={doc.mandatory} onChange={e => { const upd = [...reqDocs]; upd[idx] = { ...upd[idx], mandatory: e.target.checked }; setReqDocs(upd); }} className="rounded border-light bg-subtle" />
                    Required
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-dim cursor-pointer" title="Needs AI analysis">
                    <input type="checkbox" checked={doc.requiresAnalysis !== false} onChange={e => { const upd = [...reqDocs]; upd[idx] = { ...upd[idx], requiresAnalysis: e.target.checked }; setReqDocs(upd); }} className="rounded border-light bg-subtle" />
                    <span className="text-indigo-400">AI Analysis</span>
                  </label>
                  <button onClick={() => removeReqDoc(doc.type)} className="p-1.5 rounded-lg text-dim hover:text-red-400 hover:bg-red-500/10"><X size={14} /></button>
                </div>
              ))}
              <div className="flex gap-2 items-center">
                <input value={newDocLabel} onChange={e => setNewDocLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReqDoc()} placeholder="Document name (e.g. Bank Statement)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
                <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer">
                  <input type="checkbox" checked={newDocMandatory} onChange={e => setNewDocMandatory(e.target.checked)} className="rounded border-light bg-subtle" />
                  Required
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer" title="Needs AI analysis">
                  <input type="checkbox" checked={newDocAI} onChange={e => setNewDocAI(e.target.checked)} className="rounded border-light bg-subtle" />
                  <span className="text-indigo-400">AI</span>
                </label>
                <button onClick={addReqDoc} disabled={!newDocLabel.trim()} className="px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium disabled:opacity-30"><Plus size={14} /></button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(Array.isArray(link.required_documents) ? link.required_documents : []).length === 0 ? (
                <div className="text-center py-12 text-dim"><Shield size={32} className="mx-auto mb-2" /><p className="text-sm">No required documents configured. Click Edit to add.</p></div>
              ) : (Array.isArray(link.required_documents) ? link.required_documents : []).map((doc: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-subtle bg-card-hover">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-subtle`}>
                    <span className="w-2 h-2 rounded-full bg-dim" />
                  </div>
                  <span className="text-sm text-main flex-1">{doc.label}</span>
                  {doc.requiresAnalysis !== false
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">AI Analysis</span>
                    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/15 text-dim">Upload Only</span>
                  }
                  {doc.mandatory && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">Mandatory</span>}
                  {!doc.mandatory && <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/15 text-muted">Optional</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-0">
          {activity.length === 0 ? (
            <div className="text-center py-12 text-dim"><Clock size={32} className="mx-auto mb-2" /><p className="text-sm">No activity recorded.</p></div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-subtle" />
              {activity.map((a, i) => (
                <div key={a.id} className="relative pb-5">
                  <div className={`absolute left-[-13px] w-3 h-3 rounded-full border-2 ${i === 0 ? 'border-indigo-500 bg-indigo-500/30' : 'border-light bg-subtle'}`} />
                  <div className="ml-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-main">{a.actor_name || 'System'}</span>
                      <span className="text-xs text-muted">{formatAction(a.action)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-dim">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    {a.details && Object.keys(a.details).length > 0 && (
                      <div className="mt-1 text-xs text-dim">
                        {Object.entries(a.details).filter(([k]) => k !== 'bulk').map(([k, v]) => (
                          <span key={k} className="mr-3">{k}: <span className="text-muted">{String(v)}</span></span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-subtle bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-main mb-4">Review Vendor</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-main block mb-2">Set Folder Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'under_review', label: 'Under Review', icon: Eye, color: 'blue' },
                    { id: 'verified', label: 'Verify (Approve)', icon: CheckCircle, color: 'emerald' },
                    { id: 'rejected', label: 'Reject', icon: XSquare, color: 'red' },
                    { id: 'pending', label: 'Reset to Pending', icon: RotateCcw, color: 'zinc' },
                  ].map(s => (
                    <button key={s.id} onClick={() => setReviewStatus(s.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${reviewStatus === s.id ? `border-${s.color}-500/30 bg-${s.color}-500/10 text-${s.color}-300` : 'border-subtle text-muted hover:border-light'}`}>
                      <s.icon size={14} /> {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-main block mb-1.5">Review Notes</label>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} placeholder="Optional notes about this review..."
                  className="w-full px-4 py-2.5 rounded-xl bg-subtle border border-subtle text-sm text-main placeholder-zinc-600 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-subtle text-sm text-muted">Cancel</button>
              <button onClick={handleReview} disabled={reviewing || !reviewStatus} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-main text-sm font-medium disabled:opacity-50">
                {reviewing ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />} {reviewing ? 'Saving...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-subtle bg-card overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-subtle">
              <h3 className="text-sm font-medium text-main">{previewDoc.filename}</h3>
              <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-lg text-dim hover:text-main"><X size={16} /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)]">
              {previewDoc.summary && (
                <div className="mb-4 p-4 rounded-xl bg-card-hover border border-subtle">
                  <h4 className="text-xs font-medium text-muted mb-2">AI Summary</h4>
                  <p className="text-sm text-main leading-relaxed">{previewDoc.summary}</p>
                </div>
              )}
              {previewDoc.extracted_data && (() => {
                const ext = typeof previewDoc.extracted_data === 'string' ? JSON.parse(previewDoc.extracted_data) : previewDoc.extracted_data;
                const fields = Object.entries(ext).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(typeof v === 'object' && Object.keys(v as any).length === 0));
                return (
                  <div className="p-4 rounded-xl bg-card-hover border border-subtle">
                    <h4 className="text-xs font-medium text-muted mb-3">Extracted Data</h4>
                    {ext.documentType && (
                      <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <span className="text-[10px] text-indigo-300 font-medium">{String(ext.documentType).replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {fields.map(([key, val]) => {
                        if (key === 'rawMatches' || key === 'documentType') return null;
                        const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                        const isObj = typeof val === 'object';
                        return (
                          <div key={key} className="flex items-start gap-3 py-1.5 border-b border-subtle last:border-0">
                            <span className="text-xs text-dim w-32 shrink-0">{label}</span>
                            <span className="text-xs text-main flex-1">
                              {isObj ? <pre className="whitespace-pre-wrap text-[11px]">{JSON.stringify(val, null, 2)}</pre> : String(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {!previewDoc.summary && !previewDoc.extracted_data && <p className="text-sm text-dim text-center py-8">No preview data available for this document.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SCORE_COLORS: Record<string, { icon: string; bg: string; border: string; glow: string }> = {
  emerald: { icon: '#34d399', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)', glow: 'rgba(16,185,129,0.08)' },
  amber:   { icon: '#fbbf24', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', glow: 'rgba(245,158,11,0.08)' },
  red:     { icon: '#f87171', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.18)',  glow: 'rgba(239,68,68,0.08)' },
  indigo:  { icon: '#818cf8', bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.18)', glow: 'rgba(99,102,241,0.08)' },
  blue:    { icon: '#60a5fa', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)', glow: 'rgba(59,130,246,0.08)' },
};

function ScoreCard({ label, value, suffix, color, icon: Icon }: { label: string; value: number; suffix?: string; color: string; icon: any }) {
  const c = SCORE_COLORS[color] || SCORE_COLORS.indigo;
  return (
    <div className="rounded-xl p-4 transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 4px 16px ${c.glow}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: c.icon }} />
        <span className="text-xs text-dim font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-main">{value}{suffix && <span className="text-sm text-dim font-normal">{suffix}</span>}</p>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    created: 'created this vendor link',
    analyzed: 'ran AI analysis',
    document_uploaded: 'uploaded a document',
    status_changed_verified: 'verified the folder',
    status_changed_rejected: 'rejected the folder',
    status_changed_under_review: 'set to under review',
    status_changed_pending: 'reset to pending',
    document_approved: 'approved a document',
    document_rejected: 'rejected a document',
    document_needs_reupload: 'requested re-upload for a document',
    comment_added: 'added a comment',
    locked: 'locked the folder',
    unlocked: 'unlocked the folder',
    deactivated: 'deactivated the link',
    activated: 'activated the link',
    reminder_sent: 'sent a reminder',
  };
  return map[action] || action.replace(/_/g, ' ');
}
