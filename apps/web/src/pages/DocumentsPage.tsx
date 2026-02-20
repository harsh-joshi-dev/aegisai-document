import { useMemo, useState } from 'react';
import { DocumentTable } from '../ui/DocumentTable';
import { UploadModal, type UploadPayload } from '../ui/UploadModal';
import { useWorkspace } from '../state/workspace';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { BulkApproveModal } from '../ui/BulkApproveModal';
import { BulkRejectModal } from '../ui/BulkRejectModal';
import { useAuth } from '../state/auth';
import { Archive, Plus, Filter, Search, ChevronDown, Zap, Layers, ArrowRight } from 'lucide-react';
import { deleteDocument, uploadFile } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';

export default function DocumentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { documents, users, updateDocument, removeDocument, addActivity, auditLog, bulkApprove, bulkReject, refreshDocuments } = useStore();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState('all');
  const [risk, setRisk] = useState('all');
  const [vendor, setVendor] = useState('all');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [onlyMyApprovals, setOnlyMyApprovals] = useState(false);
  const [pendingReviewOnly, setPendingReviewOnly] = useState(false);
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'me' | 'unassigned' | string>('all');
  const [openUpload, setOpenUpload] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);

  useEffect(() => {
    const preset = (location.state as any)?.preset as string | undefined;
    if (!preset) return;

    const resets: Record<string, () => void> = {
      pending_review: () => { setStatus('all'); setPendingReviewOnly(true); setHighRiskOnly(false); setOverdueOnly(false); setEscalatedOnly(false); },
      high_risk: () => { setStatus('all'); setPendingReviewOnly(false); setHighRiskOnly(true); setOverdueOnly(false); setEscalatedOnly(false); },
      overdue: () => { setStatus('all'); setPendingReviewOnly(false); setHighRiskOnly(false); setOverdueOnly(true); setEscalatedOnly(false); },
      escalated: () => { setStatus('all'); setPendingReviewOnly(false); setHighRiskOnly(false); setEscalatedOnly(true); setOverdueOnly(false); },
      all: () => { setStatus('all'); setPendingReviewOnly(false); setHighRiskOnly(false); setOverdueOnly(false); setEscalatedOnly(false); },
    };

    resets[preset]?.();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const workspaceDocs = useMemo(
    () => documents.filter((d) => d.workspaceId === activeWorkspace.id),
    [activeWorkspace.id, documents]
  );

  const actionableStatuses = useMemo(
    () => new Set(['pending', 'review_required', 'pending_info', 'under_review', 'needs_info']),
    []
  );

  const isActionable = (id: string) => {
    const doc = filtered.find((d) => d.id === id);
    return !!doc && actionableStatuses.has(doc.status);
  };

  const canBulkAct = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return false;
    const role = users.find((u) => u.email.toLowerCase() === email)?.role;
    return role === 'Owner' || role === 'Admin';
  }, [user?.email, users]);

  const archiveCandidatesByDays = useMemo(() => {
    const now = Date.now();
    const thresholds = [30, 60, 90] as const;
    const getCount = (days: number) => {
      const ms = days * 24 * 60 * 60 * 1000;
      return workspaceDocs.filter((d) => (d.status === 'approved' || d.status === 'rejected') && now - new Date(d.date).getTime() >= ms).length;
    };
    return thresholds.map((days) => ({ days, count: getCount(days) }));
  }, [workspaceDocs]);

  const filtered = useMemo(
    () =>
      workspaceDocs.filter((d) => {
        const now = Date.now();
        const statusMatch = status === 'all' || d.status === status;
        const pendingReviewMatch = !pendingReviewOnly || actionableStatuses.has(d.status);
        const riskMatch = risk === 'all' || d.riskLevel === risk;
        const vendorMatch = vendor === 'all' || d.vendor === vendor;
        const myMatch = !onlyMyApprovals || (user?.email && d.assignedTo === user.email);
        const highRiskMatch = !highRiskOnly || d.riskLevel === 'High' || d.riskLevel === 'Critical';
        const overdueMatch =
          !overdueOnly || (!d.escalatedAt && d.slaDueAt && new Date(d.slaDueAt).getTime() < now);
        const escalatedMatch = !escalatedOnly || !!d.escalatedAt;
        const dateMatch = !dateFrom || d.date >= dateFrom;
        const assignedMatch = (() => {
          if (assignedFilter === 'all') return true;
          if (assignedFilter === 'me') return !!user?.email && d.assignedTo === user.email;
          if (assignedFilter === 'unassigned') return !d.assignedTo;
          return d.assignedTo === assignedFilter;
        })();
        const q = query.trim().toLowerCase();
        const queryMatch =
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.vendor.toLowerCase().includes(q) ||
          String(d.amount).includes(q);
        return statusMatch && pendingReviewMatch && riskMatch && vendorMatch && myMatch && highRiskMatch && overdueMatch && escalatedMatch && dateMatch && assignedMatch && queryMatch;
      }),
    [
      workspaceDocs,
      status,
      pendingReviewOnly,
      actionableStatuses,
      risk,
      vendor,
      query,
      dateFrom,
      onlyMyApprovals,
      highRiskOnly,
      overdueOnly,
      escalatedOnly,
      assignedFilter,
      user?.email,
    ]
  );

  const selectedDocs = useMemo(() => filtered.filter((d) => selected.has(d.id)), [filtered, selected]);
  const hasCriticalSelected = useMemo(
    () => selectedDocs.some((d) => d.riskLevel === 'Critical'),
    [selectedDocs]
  );

  const toggle = (id: string) => {
    if (!isActionable(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const actionable = filtered.filter((d) => actionableStatuses.has(d.status));
      const allSelected = actionable.length > 0 && actionable.every((d) => next.has(d.id));
      if (allSelected) {
        actionable.forEach((d) => next.delete(d.id));
      } else {
        actionable.forEach((d) => next.add(d.id));
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-12 pb-20"
    >
      <div className="fixed inset-0 z-[-1] pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-indigo-500/5 to-transparent" />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-12 bg-indigo-500 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Node Cluster</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-main font-display">
            Intelligence <span className="text-gradient">Ledger</span>
          </h1>
          <p className="text-dim text-lg font-medium max-w-2xl leading-relaxed">
            Scalable repository for multi-threaded document heuristics and compliance governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <AnimatePresence>
            {canBulkAct && selectedDocs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="flex items-center gap-4 glass-card p-2 pr-4 border-indigo-500/20 shadow-glow"
              >
                <div className="px-4 py-2 rounded-xl bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  {selectedDocs.length} Isolated
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-colors"
                    onClick={() => setBulkRejectOpen(true)}
                  >
                    Purge Batch
                  </button>
                  <button
                    className="btn-primary h-10 px-6 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                    disabled={hasCriticalSelected}
                    onClick={() => setBulkApproveOpen(true)}
                  >
                    {hasCriticalSelected ? 'Lock Applied' : 'Authorize All'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setOpenUpload(true)}
            className="btn-primary h-12 px-8 flex items-center gap-3 shadow-glow-primary"
          >
            <Plus size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">Inject Data</span>
          </button>
        </div>
      </div>

      {/* Hygiene Insights Row */}
      {archiveCandidatesByDays.some(x => x.count > 0) && (
        <div className="grid gap-6 md:grid-cols-3">
          {archiveCandidatesByDays.filter(x => x.count > 0).map((x, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={x.days}
              className="card-premium p-8 group relative overflow-hidden bg-indigo-500/[0.02] border-indigo-500/10 hover:border-indigo-500/30"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                  <Archive size={20} />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/60">Ledger Hygiene</span>
                  <h3 className="text-lg font-bold text-main">Archive Required</h3>
                </div>
              </div>
              <p className="text-sm text-dim font-medium leading-relaxed mb-8">
                Heuristics detected <span className="text-indigo-400 font-bold">{x.count} legacy nodes</span> inactive for {x.days}+ days. Cleanse to optimize cluster focus.
              </p>
              <div className="flex items-center gap-6">
                <button
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                  onClick={() => { setStatus('approved'); setDateFrom(''); }}
                >
                  Verify Data
                </button>
                <button
                  className="text-[10px] font-black uppercase tracking-widest text-dim hover:text-main transition-colors flex items-center gap-2"
                  onClick={() => { setStatus('rejected'); setDateFrom(''); }}
                >
                  Reject Logic <ArrowRight size={12} />
                </button>
              </div>
              <Zap size={100} className="absolute -bottom-8 -right-8 text-indigo-500 opacity-[0.03] group-hover:scale-125 group-hover:rotate-12 transition-transform duration-1000" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Advanced Filter Matrix */}
      <div className="card-premium p-10 bg-subtle/20 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Filter size={18} />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold text-main font-display">Heuristic Filters</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-dim">Parameter Matrix Tuner</p>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="sm:col-span-2 relative group">
            <label className="mb-3 block text-[10px] font-black text-dim uppercase tracking-widest px-1">Global Neural Search</label>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-card hover:bg-subtle/50 border border-subtle focus:border-indigo-500/50 rounded-2xl pl-14 pr-6 h-14 text-sm text-main placeholder:text-dim/40 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none font-medium"
                placeholder="Name, Vendor, or ID..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="mb-3 block text-[10px] font-black text-dim uppercase tracking-widest px-1">Ledger State</label>
            <div className="relative group">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-card hover:bg-subtle/50 border border-subtle focus:border-indigo-500/50 rounded-2xl px-6 h-14 text-sm text-main appearance-none cursor-pointer outline-none transition-all font-bold"
              >
                <option value="all">Spectrum: Full</option>
                <option value="pending">State: Inbound</option>
                <option value="under_review">State: Active Review</option>
                <option value="needs_info">State: Query Open</option>
                <option value="approved">State: Authorized</option>
                <option value="rejected">State: Sanctioned</option>
                <option value="archived">State: Vaulted</option>
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-dim group-hover:text-main transition-colors">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="mb-3 block text-[10px] font-black text-dim uppercase tracking-widest px-1">Risk Heuristics</label>
            <div className="relative group">
              <select
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                className="w-full bg-card hover:bg-subtle/50 border border-subtle focus:border-indigo-500/50 rounded-2xl px-6 h-14 text-sm text-main appearance-none cursor-pointer outline-none transition-all font-bold"
              >
                <option value="all">Risk: Any</option>
                <option value="Safe">Risk: Neutral</option>
                <option value="Review Required">Risk: Validation</option>
                <option value="High">Risk: Anomalous</option>
                <option value="Critical">Risk: Critical</option>
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-dim group-hover:text-main transition-colors">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-10 border-t border-subtle flex flex-col xl:flex-row xl:items-center gap-8">
          <div className="flex flex-wrap gap-4 flex-1">
            {[
              { label: 'Authorized Logs', checked: onlyMyApprovals, set: setOnlyMyApprovals },
              { label: 'Active Intervention', checked: pendingReviewOnly, set: setPendingReviewOnly },
              { label: 'Extreme Exposure', checked: highRiskOnly, set: setHighRiskOnly, color: 'var(--danger)' },
              { label: 'SLA Anomalies', checked: overdueOnly, set: setOverdueOnly, color: 'var(--warning)' },
              { label: 'Escalation Node', checked: escalatedOnly, set: setEscalatedOnly, color: 'var(--accent)' },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => chip.set(!chip.checked)}
                className={`
                  inline-flex items-center gap-3 px-6 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all select-none
                  ${chip.checked
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-glow ring-1 ring-indigo-500/20'
                    : 'bg-subtle/50 border-subtle text-dim hover:bg-subtle hover:text-main'
                  }
                `}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-all ${chip.checked ? 'bg-indigo-500 shadow-[0_0_8px_var(--primary)]' : 'bg-dim/30'}`}
                  style={chip.checked && chip.color ? { backgroundColor: chip.color, boxShadow: `0 0 10px ${chip.color}` } : {}}
                />
                {chip.label}
              </button>
            ))}
          </div>

          <button
            className="text-[10px] font-black uppercase tracking-[0.2em] text-dim hover:text-indigo-400 transition-all px-6 py-3 rounded-2xl bg-subtle/50 hover:bg-subtle border border-transparent hover:border-indigo-500/20 flex items-center justify-center gap-2"
            onClick={() => {
              setQuery(''); setStatus('all'); setRisk('all'); setVendor('all'); setAssignedFilter('all');
              setOnlyMyApprovals(false); setHighRiskOnly(false); setPendingReviewOnly(false); setOverdueOnly(false); setEscalatedOnly(false); setDateFrom('');
            }}
          >
            Reset Intelligence Grid
          </button>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {filtered.length ? (
          <DocumentTable
            documents={filtered}
            selectedIds={canBulkAct ? selected : undefined}
            onToggle={canBulkAct ? toggle : undefined}
            onToggleAll={canBulkAct ? toggleAll : undefined}
            isRowSelectable={(d) => actionableStatuses.has(d.status)}
            onDelete={async (doc) => {
              const ok = window.confirm(`Terminate Nexus Link "${doc.name}"? This will purge the intelligence record permanently.`);
              if (!ok) return;
              try {
                removeDocument(doc.id);
                await deleteDocument(doc.id);
                await refreshDocuments();
                push({ kind: 'success', title: 'Isolation Complete', message: doc.name });
              } catch (e: any) {
                await refreshDocuments();
                push({ kind: 'error', title: 'Lock Failed', message: e?.message || 'Permission denied' });
              }
            }}
            onArchive={(doc) => {
              const actorEmail = user?.email || '';
              if (!actorEmail) { push({ kind: 'error', title: 'Identity Required', message: 'Authenticate to continue.' }); return; }
              const tenant_id = doc.tenant_id || doc.workspaceId;
              updateDocument(doc.id, { status: 'archived', preArchiveStatus: doc.status });
              addActivity({ id: `act-${Date.now()}`, workspaceId: doc.workspaceId, ts: new Date().toISOString(), actorEmail, docId: doc.id, type: 'note', message: 'Nexus link vaulted' });
              auditLog({ tenant_id, document_id: doc.id, action: 'archived', performed_by: actorEmail, metadata: { prev: doc.status } });
              push({ kind: 'success', title: 'Vaulted', message: doc.name });
            }}
            onRestore={(doc) => {
              const actorEmail = user?.email || '';
              if (!actorEmail) { push({ kind: 'error', title: 'Identity Required', message: 'Authenticate to continue.' }); return; }
              const tenant_id = doc.tenant_id || doc.workspaceId;
              const restoreTo = doc.preArchiveStatus && doc.preArchiveStatus !== 'archived' ? doc.preArchiveStatus : 'approved';
              updateDocument(doc.id, { status: restoreTo, preArchiveStatus: undefined });
              addActivity({ id: `act-${Date.now()}`, workspaceId: doc.workspaceId, ts: new Date().toISOString(), actorEmail, docId: doc.id, type: 'note', message: `Nexus link restored → ${restoreTo}` });
              auditLog({ tenant_id, document_id: doc.id, action: 'restored', performed_by: actorEmail, metadata: { to: restoreTo } });
              push({ kind: 'success', title: 'Restored', message: doc.name });
            }}
            showWorkflowColumns
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-premium py-32 text-center"
          >
            <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-500/10 flex items-center justify-center mx-auto mb-8 border border-indigo-500/20 shadow-inner">
              <Layers className="w-10 h-10 text-indigo-400/40" />
            </div>
            <h3 className="text-2xl font-bold text-main mb-3">No Neural Matches</h3>
            <p className="text-dim max-w-sm mx-auto mb-10 font-medium font-sans">Your parameters returned zero active nodes. Adjust simulation matrix to broaden search.</p>
            <button
              className="btn-primary-xl h-14 px-10 text-xs font-black uppercase tracking-widest"
              onClick={() => {
                setQuery(''); setStatus('all'); setRisk('all'); setVendor('all'); setAssignedFilter('all');
                setOnlyMyApprovals(false); setHighRiskOnly(false); setPendingReviewOnly(false); setOverdueOnly(false); setEscalatedOnly(false); setDateFrom('');
              }}
            >
              Clear Simulation Parameters
            </button>
          </motion.div>
        )}
      </div>

      <UploadModal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        onUpload={async (p: UploadPayload) => {
          try {
            const resp = await uploadFile(p.file);
            await refreshDocuments();
            push({ kind: 'success', title: 'Injection Successful', message: resp.document.filename });
            navigate(`/document/${resp.document.id}`);
          } catch (e: any) {
            push({ kind: 'error', title: 'Protocol Failure', message: e?.message || 'Data stream corrupted' });
          }
        }}
      />

      <BulkApproveModal
        open={bulkApproveOpen}
        onClose={() => setBulkApproveOpen(false)}
        docs={selectedDocs}
        onConfirm={async () => {
          const res = await bulkApprove(selectedDocs.map((d) => d.id), user?.email || '');
          if (!res.ok) { push({ kind: 'error', title: 'Protocol Rejected', message: res.error }); return; }
          await refreshDocuments();
          push({ kind: 'success', title: 'Batch Authorized', message: `${selectedDocs.length} nodes successfully cleared.` });
          setSelected(new Set());
          setBulkApproveOpen(false);
        }}
      />

      <BulkRejectModal
        open={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        docs={selectedDocs}
        onConfirm={async (note) => {
          const res = await bulkReject(selectedDocs.map((d) => d.id), user?.email || '', note);
          if (!res.ok) { push({ kind: 'error', title: 'Protocol Rejected', message: res.error }); return; }
          await refreshDocuments();
          push({ kind: 'success', title: 'Batch Purged', message: `${selectedDocs.length} nodes officially sanctioned.` });
          setSelected(new Set());
          setBulkRejectOpen(false);
        }}
      />
    </motion.div>
  );
}
