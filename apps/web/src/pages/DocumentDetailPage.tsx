import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Download, Maximize2, Flag, CheckCircle, XCircle, AlertTriangle, FileText, Activity } from 'lucide-react';
import { RiskBadge } from '../ui/RiskBadge';
import { IssueCard } from '../ui/IssueCard';
import { RecommendationCard } from '../ui/RecommendationCard';
import { RejectModal } from '../ui/RejectModal';
import { RequestInfoModal } from '../ui/RequestInfoModal';
import { SubmitInfoModal } from '../ui/SubmitInfoModal';
import { useWorkspace } from '../state/workspace';
import { useMockStore } from '../state/mockStore';
import { useToast } from '../state/toast';
import { useMockAuth } from '../state/mockAuth';
import { computeApprovalRequirements } from '../services/approvalRequirements';
import { format } from 'date-fns';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [submitInfoOpen, setSubmitInfoOpen] = useState(false);
  const [, setDecision] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'issues' | 'data' | 'activity'>('overview');
  const { activeWorkspace } = useWorkspace();
  const { documents, users, activity, updateDocument, approveDocument, rejectDocument } = useMockStore();
  const { push } = useToast();
  const { user } = useMockAuth();

  const actorRole = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return users.find((u) => u.email.toLowerCase() === email)?.role ?? null;
  }, [user?.email, users]);

  const doc = useMemo(() => {
    const workspaceDocs = documents.filter((d) => d.workspaceId === activeWorkspace.id);
    const found = workspaceDocs.find((d) => d.id === id);
    return found ?? workspaceDocs[0] ?? documents[0] ?? null;
  }, [documents, id, activeWorkspace.id]);

  if (!doc) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in">
        <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center border border-white/5">
          <FileText className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-xl font-semibold text-white">Document Not Found</h2>
        <Link to="/documents" className="btn-primary">Return to Documents</Link>
      </div>
    );
  }

  const auditEvents = useMemo(() => {
    return (activity || [])
      .filter((a) => a.workspaceId === activeWorkspace.id)
      .filter((a) => a.docId === doc.id)
      .slice(0, 12);
  }, [activity, activeWorkspace.id, doc.id]);

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
            {doc.fileUrl ? (
              <div className="absolute inset-0 flex flex-col">
                {doc.fileUrl.startsWith('data:application/pdf') ? (
                  <iframe
                    src={`${doc.fileUrl}#toolbar=0&navpanes=0&view=FitH`}
                    title={doc.name}
                    className="flex-1 w-full min-h-[500px] border-0"
                    style={{ background: '#1a1a1d' }}
                  />
                ) : doc.fileUrl.startsWith('data:image/') ? (
                  <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={doc.fileUrl}
                      alt={doc.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <iframe
                    src={`${doc.fileUrl}#toolbar=0&navpanes=0&view=FitH`}
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
                      Upload documents with file attachment to view PDF or image preview here.
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
                onClick={() => approveDocument(doc.id, user?.email || '')}
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
            <div className="flex items-center border-b border-white/5 bg-white/[0.02]">
              {['overview', 'issues', 'data', 'activity'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t as any)}
                  className={`
                        flex-1 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors
                        ${tab === t ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                      `}
                >
                  {t}
                  {t === 'issues' && doc.issues.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] text-white">
                      {doc.issues.length}
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
                            className={`rounded-lg border p-3 text-sm ${
                              sig.severity === 'CRITICAL' ? 'border-red-500/20 bg-red-500/5' :
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
                  {doc.issues.length ? doc.issues.map(i => (
                    <IssueCard key={i.id} issue={i} />
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

              {tab === 'activity' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {auditEvents.map((ev, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="mt-1 relative">
                        <div className="w-2 h-2 rounded-full bg-zinc-700 ring-4 ring-[#0e0e11]" />
                        {i !== auditEvents.length - 1 && <div className="absolute top-2 left-1/2 -translate-x-1/2 w-px h-full bg-zinc-800" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium text-white">{ev.message}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {format(new Date(ev.ts), 'PP p')} by {ev.actorEmail?.split('@')[0]}
                        </p>
                      </div>
                    </div>
                  ))}
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
        onConfirm={(notes) => {
          const res = rejectDocument(doc.id, user?.email || '', notes);
          if (res.ok) {
            setDecision('Rejected');
            setRejectOpen(false);
            push({ kind: 'error', title: 'Rejected', message: notes });
          }
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
        onSubmit={() => { /* ... */ }}
      />
    </div>
  );
}
