import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Download, Maximize2, Flag, CheckCircle, XCircle, AlertTriangle, FileText, Activity, Upload, Cpu, ShieldCheck, Eye, Clock, Zap, Loader2 } from 'lucide-react';
import { RiskBadge } from '../ui/RiskBadge';
import { IssueCard } from '../ui/IssueCard';
import { RecommendationCard } from '../ui/RecommendationCard';
import { RejectModal } from '../ui/RejectModal';
import { RequestInfoModal } from '../ui/RequestInfoModal';
import { SubmitInfoModal } from '../ui/SubmitInfoModal';
import { useWorkspace } from '../state/workspace';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { useAuth } from '../state/auth';
import { computeApprovalRequirements } from '../services/approvalRequirements';
import { format } from 'date-fns';
import { fetchDocumentFile, getDocumentRisk, getDocumentTimeline, analyzeWhatIf, requestInfo, type TimelineEvent, type WhatIfResponse } from '../api/client';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [submitInfoOpen, setSubmitInfoOpen] = useState(false);
  const [, setDecision] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'issues' | 'data' | 'timeline' | 'whatif'>('overview');
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const timelineFetched = useRef(false);
  const [whatIfScenario, setWhatIfScenario] = useState('');
  const [whatIfAmount, setWhatIfAmount] = useState('');
  const [whatIfRemoveGst, setWhatIfRemoveGst] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const { documents, users, activity, updateDocument, approveDocument, rejectDocument, refreshDocuments } = useStore();
  const { push } = useToast();
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);
  const fetchedRiskRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    // If this route points to a document we don't have, don't spam the API.
    // (This can happen if the user opens a stale link, or documents haven't loaded yet.)
    const exists = documents.some((d) => d.id === id);
    if (!exists) return;
    if (fetchedRiskRef.current.has(id)) return;
    fetchedRiskRef.current.add(id);
    let cancelled = false;
    (async () => {
      try {
        const r = await getDocumentRisk(id);
        if (cancelled) return;
        const patch: Record<string, any> = {};
        if (Array.isArray(r.riskSignals)) patch.riskSignals = r.riskSignals;
        if (r.riskResult?.plain_english_explanations?.length) {
          patch.riskExplanations = r.riskResult.plain_english_explanations;
        }
        if (Object.keys(patch).length) updateDocument(id, patch);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, documents, updateDocument]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const { blob, contentType } = await fetchDocumentFile(id);
        if (cancelled) return;
        // Revoke previous object URL if any
        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }
        const url = URL.createObjectURL(blob);
        previewObjectUrlRef.current = url;
        setPreviewUrl(url);
        setPreviewType(contentType);
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewType(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    if (!id || timelineFetched.current) return;
    timelineFetched.current = true;
    setTimelineLoading(true);
    try {
      const res = await getDocumentTimeline(id);
      setTimelineEvents(res.timeline || []);
    } catch { /* best-effort */ }
    finally { setTimelineLoading(false); }
  }, [id]);

  useEffect(() => {
    if (tab === 'timeline') fetchTimeline();
  }, [tab, fetchTimeline]);

  const runWhatIf = useCallback(async () => {
    if (!id || !whatIfScenario.trim()) return;
    setWhatIfLoading(true);
    try {
      let scenario = whatIfScenario;
      if (whatIfAmount) scenario += ` (amount changed to ₹${whatIfAmount})`;
      if (whatIfRemoveGst) scenario += ' (GST removed from invoice)';
      const res = await analyzeWhatIf({ documentId: id, scenario });
      setWhatIfResult(res);
    } catch { /* best-effort */ }
    finally { setWhatIfLoading(false); }
  }, [id, whatIfScenario, whatIfAmount, whatIfRemoveGst]);

  const actorRole = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return users.find((u) => u.email.toLowerCase() === email)?.role ?? null;
  }, [user?.email, users]);

  const [loadingDoc, setLoadingDoc] = useState(false);
  const fetchedDocRef = useRef(false);

  const doc = useMemo(() => {
    const workspaceDocs = documents.filter((d) => d.workspaceId === activeWorkspace.id);
    const found = workspaceDocs.find((d) => d.id === id);
    return found ?? null;
  }, [documents, id, activeWorkspace.id]);

  useEffect(() => {
    if (doc || !id || fetchedDocRef.current) return;
    fetchedDocRef.current = true;
    setLoadingDoc(true);
    (async () => {
      try {
        await refreshDocuments();
      } catch { /* best-effort */ }
      finally { setLoadingDoc(false); }
    })();
  }, [doc, id, refreshDocuments]);

  if (loadingDoc) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 animate-in fade-in">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-zinc-400">Loading document...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in">
        <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center border border-white/5">
          <FileText className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-xl font-semibold text-white">Document Not Found</h2>
        <p className="text-sm text-zinc-500 max-w-md text-center">The document you're looking for doesn't exist or you may not have access to it.</p>
        <Link to="/documents" className="btn-primary">Return to Documents</Link>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _auditEvents = useMemo(() => {
    return (activity || [])
      .filter((a) => a.workspaceId === activeWorkspace.id)
      .filter((a) => a.docId === doc.id)
      .slice(0, 12);
  }, [activity, activeWorkspace.id, doc.id]);

  const issueItems = useMemo(() => {
    if (doc.issues.length > 0) return doc.issues;
    return doc.riskSignals || [];
  }, [doc.issues, doc.riskSignals]);

  const issueCount = issueItems.length;

  const approvalInfo = useMemo(() => {
    const riskLevel = doc.risk_level ?? 'review';
    const req = computeApprovalRequirements(riskLevel);
    const approvedBy = doc.approvedBy ?? [];
    const required = doc.requiredApprovals ?? req.requiredCount;
    const currentUser = user?.email || '';
    const hasApproved = approvedBy.includes(currentUser);
    const isMet = approvedBy.length >= required;

    return {
      required,
      current: approvedBy.length,
      approvedBy,
      hasApproved,
      isMet,
      requiresAdmin: req.requiresAdmin,
      canApprove: !hasApproved && (actorRole === 'Owner' || actorRole === 'Admin' || actorRole === 'Reviewer'),
    };
  }, [doc, user?.email, actorRole]);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col animate-in fade-in duration-500 overflow-hidden">

      {/* Top Bar */}
      <header className="flex items-center justify-between pb-6 shrink-0 border-b border-white/5 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/documents" className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-xl font-bold text-white">{doc.name}</h1>
              <RiskBadge level={doc.riskLevel} />
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
              <span>{doc.vendor}</span>
              <span>•</span>
              <span>{format(new Date(doc.date), 'MMM d, yyyy')}</span>
              <span>•</span>
              <span className="font-mono">ID: {doc.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary h-9 px-3 gap-2 text-xs"
            onClick={() => {
              const url = `${window.location.origin}/document/${doc.id}`;
              if (navigator.share) {
                navigator.share({ title: doc.name, url, text: `Document: ${doc.name}` }).catch(() => {
                  navigator.clipboard.writeText(url);
                  push({ kind: 'success', title: 'Link copied', message: 'Document link copied to clipboard.' });
                });
              } else {
                navigator.clipboard.writeText(url);
                push({ kind: 'success', title: 'Link copied', message: 'Document link copied to clipboard.' });
              }
            }}
          >
            <Share2 size={14} /> Share
          </button>
          <button
            type="button"
            className="btn-secondary h-9 px-3 gap-2 text-xs"
            onClick={() => {
              const csv = [
                ['Field', 'Value'].join(','),
                ['Name', doc.name].join(','),
                ['Vendor', doc.vendor].join(','),
                ['Amount', doc.amount].join(','),
                ['Date', doc.date].join(','),
                ['Risk Level', doc.riskLevel].join(','),
                ['Risk Score', doc.riskScore].join(','),
                ['Status', doc.status].join(','),
                ['Summary', (doc.summary || '').replace(/"/g, '""')].join(','),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${doc.name.replace(/\.[^.]+$/, '')}_export.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
              push({ kind: 'success', title: 'Exported', message: 'Document summary exported as CSV.' });
            }}
          >
            <Download size={14} /> Export
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6 min-h-0">

        {/* Left: PDF / Document Viewer - full width and height */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-[#0e0e11] overflow-hidden min-h-0 flex-1">
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/10 shrink-0">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Document Preview</span>
            <div className="flex gap-2">
              <button type="button" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Fullscreen">
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col bg-[#1a1a1d] relative overflow-auto">
            {previewUrl ? (
              <div className="absolute inset-0 flex flex-col">
                {String(previewType || '').includes('pdf') ? (
                  <iframe
                    src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                    title={doc.name}
                    className="flex-1 w-full min-h-[500px] border-0"
                    style={{ background: '#1a1a1d' }}
                  />
                ) : String(previewType || '').startsWith('image/') ? (
                  <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={previewUrl}
                      alt={doc.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <iframe
                    src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                    title={doc.name}
                    className="flex-1 w-full min-h-[500px] border-0"
                    style={{ background: '#1a1a1d' }}
                  />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-2xl flex-1 min-h-[400px] flex flex-col rounded-xl border border-white/10 bg-[#121214] overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-zinc-500" />
                      <span className="font-semibold text-white truncate">{doc.name}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{doc.docType || 'Document'}</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <FileText size={32} className="text-zinc-500" />
                    </div>
                    <p className="text-lg font-medium text-white mb-1">Document preview</p>
                    <p className="text-sm text-zinc-400 max-w-md mb-4">
                      {previewLoading ? 'Loading preview…' : 'Preview not available for this document.'}
                    </p>
                    <div className="inline-flex flex-wrap gap-3 justify-center text-xs text-zinc-500">
                      <span>Vendor: {doc.vendor}</span>
                      <span>•</span>
                      <span>Amount: ₹{doc.amount?.toLocaleString('en-IN') ?? '—'}</span>
                      <span>•</span>
                      <span>Date: {doc.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Issue pin overlay */}
            {doc.issues.length > 0 && (
              <div className="absolute top-[20%] left-[30%] z-10 pointer-events-none">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-red-500/30 border-2 border-red-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  </div>
                  <div className="absolute left-8 top-0 bg-zinc-900/95 border border-white/10 rounded-lg px-3 py-2 text-xs w-48 backdrop-blur-sm">
                    <p className="font-semibold text-white">{doc.issues[0]?.title ?? 'Issue'}</p>
                    <p className="text-zinc-400 mt-0.5">{doc.issues[0]?.explanation?.slice(0, 60) ?? 'See Issues tab for details.'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex flex-col min-h-0">
          {/* Actions Card */}
          <div className="card-premium p-5 mb-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-white">Decision</h3>
                <p className="text-xs text-zinc-400">Current Status: <span className="text-white font-medium capitalize">{doc.status.replace('_', ' ')}</span></p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-display font-bold text-white tracking-tight">{doc.riskScore}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                className="btn-primary h-12 text-base shadow-lg shadow-indigo-500/20"
                disabled={!approvalInfo.canApprove}
                onClick={async () => {
                  const res = await approveDocument(doc.id, user?.email || '');
                  if (!res.ok) {
                    push({ kind: 'error', title: 'Approve failed', message: res.error || 'Could not approve' });
                    return;
                  }
                  push({ kind: 'success', title: 'Approved', message: doc.name });
                }}
              >
                <CheckCircle className="mr-2" size={18} /> Approve
              </button>
              <button
                className="btn-secondary bg-[#1c1c1e] text-white border-white/5 hover:bg-[#27272a] h-12"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-2" size={18} /> Reject
              </button>
              <button
                className="btn-secondary bg-[#1c1c1e] text-zinc-400 border-white/5 hover:text-white h-10 text-xs"
                onClick={() => setRequestInfoOpen(true)}
              >
                Request Info
              </button>
              <button
                className="btn-secondary bg-[#1c1c1e] text-zinc-400 border-white/5 hover:text-white h-10 text-xs"
                onClick={() => {
                  updateDocument(doc.id, { status: 'review_required' });
                  push({ kind: 'warning', title: 'Flagged', message: 'Document flagged for review.' });
                }}
              >
                <Flag className="mr-2" size={14} /> Flag
              </button>
            </div>
          </div>

          {/* Tabs & Content */}
          <div className="flex-1 card-premium flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center border-b border-white/5 bg-white/[0.02] overflow-x-auto">
              {['overview', 'issues', 'data', 'timeline', 'whatif'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t as any)}
                  className={`
                        flex-1 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap px-2
                        ${tab === t ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                      `}
                >
                  {t === 'whatif' ? 'What If' : t}
                  {t === 'issues' && issueCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] text-white">
                      {issueCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0e0e11]">
              {tab === 'overview' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {/* Risk Signals (from engine) */}
                  {doc.riskSignals && doc.riskSignals.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Risk Signals</h4>
                      <div className="space-y-2">
                        {doc.riskSignals.map((sig) => (
                          <div
                            key={sig.id}
                            className={`rounded-lg border p-3 text-sm ${sig.severity === 'CRITICAL' ? 'border-red-500/20 bg-red-500/5' :
                                sig.severity === 'HIGH' ? 'border-orange-500/20 bg-orange-500/5' :
                                  sig.severity === 'MEDIUM' ? 'border-amber-500/20 bg-amber-500/5' :
                                    'border-zinc-600/30 bg-zinc-800/30'
                              }`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="font-semibold text-white">{sig.title}</span>
                              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">
                                {sig.type}
                              </span>
                            </div>
                            <p className="text-zinc-400 text-xs leading-relaxed mb-1">{sig.description}</p>
                            <p className="text-zinc-500 text-xs">
                              {typeof sig.recommendation === 'string'
                                ? sig.recommendation
                                : sig.recommendation?.reason || 'Review document'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plain English Risk Explanations */}
                  {doc.riskExplanations && doc.riskExplanations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">What This Means</h4>
                      <div className="space-y-2">
                        {doc.riskExplanations.map((explanation, idx) => (
                          <div
                            key={idx}
                            className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                          >
                            <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-zinc-300 leading-relaxed">{explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Documents */}
                  {doc.linkedDocumentIds && doc.linkedDocumentIds.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Linked Documents</h4>
                      <div className="space-y-2">
                        {doc.linkedDocumentIds.map((linkedId) => {
                          const linked = documents.find((d) => d.id === linkedId);
                          if (!linked) return null;
                          return (
                            <Link
                              key={linked.id}
                              to={`/document/${linked.id}`}
                              className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/5 transition-colors"
                            >
                              <FileText size={16} className="text-zinc-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{linked.name}</p>
                                <p className="text-xs text-zinc-500">{linked.docType || 'Document'} · ₹{linked.amount?.toLocaleString('en-IN') ?? '—'}</p>
                              </div>
                              <span className="text-xs text-indigo-400">View →</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className="relative rounded-xl bg-indigo-500/5 border border-indigo-500/10 p-4">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-xl" />
                    <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-300 mb-2">
                      <Activity size={16} /> AI Summary
                    </h4>
                    <p className="text-sm text-zinc-300 leading-relaxed">{doc.summary}</p>
                  </div>

                  {/* Mismatches */}
                  {doc.mismatches.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Mismatches Detected</h4>
                      <div className="space-y-2">
                        {doc.mismatches.map((m, i) => (
                          <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-red-300">{m.field}</span>
                              <AlertTriangle size={14} className="text-red-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                              <div>
                                <span className="block text-red-500/60">Document</span>
                                <span className="block font-mono text-zinc-300 mt-1">{m.sourceA}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-red-500/60">System of Record</span>
                                <span className="block font-mono text-zinc-300 mt-1">{m.sourceB}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Recommendations</h4>
                    <div className="space-y-2">
                      {doc.recommendations.map(r => (
                        <RecommendationCard key={r.id} text={r.text} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'issues' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  {issueItems.length ? issueItems.map((i: any) => (
                    <IssueCard key={i.id || `${doc.id}-${i.title || i.explanation || Math.random()}`} issue={i} />
                  )) : (
                    <div className="text-center py-10 text-zinc-500">
                      <CheckCircle className="mx-auto mb-2 opacity-50" />
                      No active issues.
                    </div>
                  )}
                </div>
              )}

              {tab === 'data' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/5">
                      {[
                        ['Vendor Name', doc.vendor],
                        ['Invoice Amount', `₹${doc.amount.toLocaleString('en-IN')}`],
                        ['GST Number', doc.gst],
                        ['Invoice Date', format(new Date(doc.date), 'PP')],
                        ['Document Type', doc.docType],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td className="py-3 text-zinc-500">{k}</td>
                          <td className="py-3 text-right font-medium text-white">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'timeline' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 relative">
                  {timelineLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : timelineEvents.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                      <Clock className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No timeline events yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-zinc-800/50 rounded-full" />
                      {timelineEvents.map((ev, i) => {
                        const iconMap: Record<string, React.ReactNode> = {
                          upload: <Upload size={14} />,
                          extraction: <Cpu size={14} />,
                          rule_trigger: <AlertTriangle size={14} />,
                          pattern_detection: <Zap size={14} />,
                          risk_scored: <ShieldCheck size={14} />,
                          approval: <CheckCircle size={14} />,
                          rejection: <XCircle size={14} />,
                          info_request: <Eye size={14} />,
                        };
                        const colorMap: Record<string, string> = {
                          upload: 'border-indigo-500/30 text-indigo-400',
                          extraction: 'border-emerald-500/30 text-emerald-400',
                          rule_trigger: 'border-amber-500/30 text-amber-400',
                          pattern_detection: 'border-orange-500/30 text-orange-400',
                          risk_scored: 'border-purple-500/30 text-purple-400',
                          approval: 'border-emerald-500/30 text-emerald-400',
                          rejection: 'border-red-500/30 text-red-400',
                          info_request: 'border-sky-500/30 text-sky-400',
                        };
                        return (
                          <div key={i} className="relative flex gap-3 pl-1 group py-2">
                            <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[#0e0e11] ring-4 ring-[#0e0e11] group-hover:bg-[#16161a] transition-colors ${colorMap[ev.type] || 'border-zinc-700 text-zinc-400'}`}>
                              {iconMap[ev.type] || <Activity size={14} />}
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-white">{ev.title}</p>
                                <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                                  {format(new Date(ev.timestamp), 'PP p')}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{ev.description}</p>
                              {ev.severity && (
                                <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-semibold ${ev.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                                    ev.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                                      ev.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-zinc-800 text-zinc-400'
                                  }`}>
                                  {ev.severity}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {tab === 'whatif' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Risk Simulation</h4>
                    <p className="text-xs text-zinc-400 mb-4">Modify parameters and see how risk changes in real-time.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Change Amount (₹)</label>
                        <input
                          type="number"
                          placeholder={String(doc.amount || '')}
                          value={whatIfAmount}
                          onChange={e => setWhatIfAmount(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/5 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-all select-none h-[38px]">
                          <input
                            type="checkbox"
                            className="accent-indigo-500 h-4 w-4"
                            checked={whatIfRemoveGst}
                            onChange={e => setWhatIfRemoveGst(e.target.checked)}
                          />
                          <span className="text-xs">Remove GST</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Scenario Description</label>
                      <textarea
                        rows={2}
                        placeholder="e.g., What if we ignore this notice? What if payment is delayed 90 days?"
                        value={whatIfScenario}
                        onChange={e => setWhatIfScenario(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                      />
                    </div>

                    <button
                      onClick={runWhatIf}
                      disabled={whatIfLoading || !whatIfScenario.trim()}
                      className="btn-primary w-full h-10 text-sm disabled:opacity-50"
                    >
                      {whatIfLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Simulating...
                        </span>
                      ) : 'Run Simulation'}
                    </button>
                  </div>

                  {whatIfResult && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div>
                          <p className="text-xs text-zinc-500">Simulated Risk Score</p>
                          <p className="text-3xl font-display font-bold text-white">{whatIfResult.analysis.riskScore}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500">Overall Severity</p>
                          <span className={`text-lg font-bold ${whatIfResult.analysis.overallSeverity === 'Critical' ? 'text-red-400' :
                              whatIfResult.analysis.overallSeverity === 'High' ? 'text-orange-400' :
                                whatIfResult.analysis.overallSeverity === 'Medium' ? 'text-amber-400' :
                                  'text-emerald-400'
                            }`}>
                            {whatIfResult.analysis.overallSeverity}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Consequences</h5>
                        {whatIfResult.analysis.consequences.map((c, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 ${c.severity === 'Critical' ? 'border-red-500/20 bg-red-500/5' :
                                c.severity === 'High' ? 'border-orange-500/20 bg-orange-500/5' :
                                  c.severity === 'Medium' ? 'border-amber-500/20 bg-amber-500/5' :
                                    'border-white/10 bg-white/[0.02]'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-white">{c.category}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.severity === 'Critical' ? 'bg-red-500/20 text-red-300' :
                                    c.severity === 'High' ? 'bg-orange-500/20 text-orange-300' :
                                      c.severity === 'Medium' ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-zinc-800 text-zinc-400'
                                  }`}>{c.severity}</span>
                                <span className="text-[10px] text-zinc-500">{c.likelihood}</span>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed">{c.description}</p>
                            <p className="text-[11px] text-zinc-500 mt-1">Impact: {c.impact}</p>
                          </div>
                        ))}
                      </div>

                      {whatIfResult.analysis.recommendations.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Recommendations</h5>
                          {whatIfResult.analysis.recommendations.map((r, i) => (
                            <div key={i} className="flex gap-2 items-start p-2 rounded-lg border border-white/5 bg-[#16161a]">
                              <CheckCircle size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-zinc-300">{r}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (notes) => {
          const res = await rejectDocument(doc.id, user?.email || '', notes);
          if (!res.ok) {
            push({ kind: 'error', title: 'Reject failed', message: res.error || 'Could not reject' });
            return;
          }
          setDecision('Rejected');
          setRejectOpen(false);
          push({ kind: 'error', title: 'Rejected', message: notes });
        }}
      />

      <RequestInfoModal
        open={requestInfoOpen}
        onClose={() => setRequestInfoOpen(false)}
        onConfirm={(message) => {
          setDecision('Needs Info');
          updateDocument(doc.id, { status: 'pending_info' });
          push({ kind: 'info', title: 'Request Sent', message });
          setRequestInfoOpen(false);
        }}
      />

      <SubmitInfoModal
        open={submitInfoOpen}
        onClose={() => setSubmitInfoOpen(false)}
        onSubmit={async (info) => {
          try {
            await requestInfo(doc.id, typeof info === 'string' ? info : 'Additional information submitted');
            updateDocument(doc.id, { status: 'pending' });
            push({ kind: 'success', title: 'Info Submitted', message: 'Your response has been submitted.' });
            setSubmitInfoOpen(false);
          } catch {
            push({ kind: 'error', title: 'Failed', message: 'Could not submit info.' });
          }
        }}
      />
    </div>
  );
}
