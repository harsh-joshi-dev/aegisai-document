import { useMemo, useState } from 'react';
import { DocumentTable } from '../ui/DocumentTable';
import { UploadModal } from '../ui/UploadModal';
import { useWorkspace } from '../state/workspace';
import { useMockStore } from '../state/mockStore';
import { calculateRisk, riskResultToDocumentFields } from '../services/risk/riskEngine';
import { useToast } from '../state/toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { BulkApproveModal } from '../ui/BulkApproveModal';
import { BulkRejectModal } from '../ui/BulkRejectModal';
import { useMockAuth } from '../state/mockAuth';
import { Archive, Plus, Filter, Search } from 'lucide-react';

type UploadPayload = {
  name: string;
  docType: 'Invoice' | 'Bank' | 'GST' | 'Other';
  vendor?: string;
  date?: string;
  fileUrl?: string;
};

export default function DocumentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { documents, rules, users, addDocument, updateDocument, addActivity, auditLog, bulkApprove, bulkReject } = useMockStore();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useMockAuth();
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

    if (preset === 'pending_review') {
      setStatus('all');
      setPendingReviewOnly(true);
      setHighRiskOnly(false);
      setOverdueOnly(false);
      setEscalatedOnly(false);
    }

    if (preset === 'high_risk') {
      setStatus('all');
      setPendingReviewOnly(false);
      setHighRiskOnly(true);
      setOverdueOnly(false);
      setEscalatedOnly(false);
    }

    if (preset === 'overdue') {
      setStatus('all');
      setPendingReviewOnly(false);
      setHighRiskOnly(false);
      setOverdueOnly(true);
      setEscalatedOnly(false);
    }

    if (preset === 'escalated') {
      setStatus('all');
      setPendingReviewOnly(false);
      setEscalatedOnly(true);
      setOverdueOnly(false);
    }

    if (preset === 'all') {
      setStatus('all');
      setPendingReviewOnly(false);
      setHighRiskOnly(false);
      setOverdueOnly(false);
      setEscalatedOnly(false);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const workspaceDocs = useMemo(
    () => documents.filter((d) => d.workspaceId === activeWorkspace.id),
    [activeWorkspace.id]
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

  const vendors = useMemo(
    () => Array.from(new Set(workspaceDocs.map((d) => d.vendor))),
    [workspaceDocs]
  );

  const assignees = useMemo(() => {
    return users.map((u) => ({ email: u.email, label: `${u.name} (${u.role})` }));
  }, [users]);

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
    <div className="w-full min-h-full space-y-8 animate-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Documents</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">Manage and audit financial documents across workspaces.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canBulkAct && selectedDocs.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e0e11] px-4 py-2 animate-in slide-in-from-right-4 fade-in">
              <p className="text-sm font-semibold text-zinc-300">Selected: {selectedDocs.length}</p>
              <div className="h-4 w-px bg-white/10 mx-2" />
              <button
                className="btn-danger h-8 px-3 text-xs"
                onClick={() => setBulkRejectOpen(true)}
              >
                Reject
              </button>
              <button
                className="btn-primary h-8 px-3 text-xs"
                disabled={hasCriticalSelected}
                onClick={() => setBulkApproveOpen(true)}
              >
                Approve {hasCriticalSelected && '(Blocked: Critical Risk)'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpenUpload(true)}
            className="btn-primary shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Upload Document
          </button>
        </div>
      </div>

      {/* Archive Suggestions */}
      {archiveCandidatesByDays.some(x => x.count > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          {archiveCandidatesByDays.filter(x => x.count > 0).map((x) => (
            <div key={x.days} className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-4 hover:bg-zinc-900/50 transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-white transition-colors">
                  <Archive size={16} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Suggestion</p>
              </div>
              <p className="text-sm font-semibold text-white">Archive {x.count} older docs ({x.days}+ days)</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline underline-offset-2"
                  onClick={() => {
                    setStatus('approved');
                    setDateFrom('');
                  }}
                >
                  View Approved
                </button>
                <span className="text-zinc-700">|</span>
                <button
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline underline-offset-2"
                  onClick={() => {
                    setStatus('rejected');
                    setDateFrom('');
                  }}
                >
                  View Rejected
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="card-premium p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">Search & Filter</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2 relative group">
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-field pl-10"
                placeholder="Search by name, vendor, id..."
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</label>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field appearance-none cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="needs_info">Needs Info</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Risk Level</label>
            <div className="relative">
              <select value={risk} onChange={(e) => setRisk(e.target.value)} className="input-field appearance-none cursor-pointer">
                <option value="all">All Risks</option>
                <option value="Safe">Safe</option>
                <option value="Review Required">Review Required</option>
                <option value="High">High Risk</option>
                <option value="Critical">Critical</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Vendor</label>
            <div className="relative">
              <select value={vendor} onChange={(e) => setVendor(e.target.value)} className="input-field appearance-none cursor-pointer">
                <option value="all">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Assignee</label>
            <div className="relative">
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="input-field appearance-none cursor-pointer">
                <option value="all">All Assignees</option>
                <option value="me">Assigned to Me</option>
                <option value="unassigned">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.email} value={a.email}>{a.label}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex flex-wrap gap-4">
          {/* Chips */}
          {[
            { label: 'My Approvals Only', checked: onlyMyApprovals, set: setOnlyMyApprovals },
            { label: 'Pending Review', checked: pendingReviewOnly, set: setPendingReviewOnly },
            { label: 'High Risk', checked: highRiskOnly, set: setHighRiskOnly, color: 'red' },
            { label: 'Overdue', checked: overdueOnly, set: setOverdueOnly, color: 'amber' },
            { label: 'Escalated', checked: escalatedOnly, set: setEscalatedOnly, color: 'rose' },
          ].map((chip) => (
            <label
              key={chip.label}
              className={`
                 cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all select-none
                 ${chip.checked
                  ? `bg-${chip.color || 'indigo'}-500/10 border-${chip.color || 'indigo'}-500/30 text-${chip.color || 'indigo'}-400`
                  : 'bg-zinc-800/30 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }
               `}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={chip.checked}
                onChange={(e) => chip.set(e.target.checked)}
              />
              {chip.checked && <div className={`w-1.5 h-1.5 rounded-full bg-${chip.color || 'indigo'}-500`} />}
              {chip.label}
            </label>
          ))}

          <button
            className="text-xs text-zinc-500 hover:text-white transition-colors ml-auto"
            onClick={() => {
              setQuery('');
              setStatus('all');
              setRisk('all');
              setVendor('all');
              setAssignedFilter('all');
              setOnlyMyApprovals(false);
              setHighRiskOnly(false);
              setPendingReviewOnly(false);
              setOverdueOnly(false);
              setEscalatedOnly(false);
              setDateFrom('');
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {filtered.length ? (
        <DocumentTable
          documents={filtered}
          selectedIds={canBulkAct ? selected : undefined}
          onToggle={canBulkAct ? toggle : undefined}
          onToggleAll={canBulkAct ? toggleAll : undefined}
          isRowSelectable={(d) => actionableStatuses.has(d.status)}
          onArchive={(doc) => {
            // ... (keep existing logic)
            const actorEmail = user?.email || '';
            if (!actorEmail) {
              push({ kind: 'error', title: 'Not signed in', message: 'Please login again.' });
              return;
            }
            const tenant_id = doc.tenant_id || doc.workspaceId;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateDocument(doc.id, { status: 'archived', preArchiveStatus: doc.status, ...(actorEmail ? ({ actorEmail } as any) : {}) });
            addActivity({ id: `act-${Date.now()}`, workspaceId: doc.workspaceId, ts: new Date().toISOString(), actorEmail, docId: doc.id, type: 'note', message: 'Archived manually' });
            auditLog({ tenant_id, document_id: doc.id, action: 'archived', performed_by: actorEmail, metadata: { previousStatus: doc.status } });
            push({ kind: 'success', title: 'Archived', message: doc.name });
          }}
          onRestore={(doc) => {
            // ... (keep existing logic)
            const actorEmail = user?.email || '';
            if (!actorEmail) {
              push({ kind: 'error', title: 'Not signed in', message: 'Please login again.' });
              return;
            }
            const tenant_id = doc.tenant_id || doc.workspaceId;
            const restoreTo = doc.preArchiveStatus && doc.preArchiveStatus !== 'archived' ? doc.preArchiveStatus : 'approved';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateDocument(doc.id, { status: restoreTo, preArchiveStatus: undefined, ...(actorEmail ? ({ actorEmail } as any) : {}) });
            addActivity({ id: `act-${Date.now()}`, workspaceId: doc.workspaceId, ts: new Date().toISOString(), actorEmail, docId: doc.id, type: 'note', message: `Restored from archive → ${restoreTo}` });
            auditLog({ tenant_id, document_id: doc.id, action: 'restored', performed_by: actorEmail, metadata: { restoredTo: restoreTo } });
            push({ kind: 'success', title: 'Restored', message: doc.name });
          }}
          showWorkflowColumns
        />
      ) : (
        <div className="card-premium py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-white">No documents match your filters</h3>
          <p className="mt-2 text-zinc-400 max-w-sm mx-auto">Try adjusting your search criteria or clear all filters to see all documents.</p>
          <button
            className="btn-secondary mt-8"
            onClick={() => {
              setQuery('');
              setStatus('all');
              setRisk('all');
              setVendor('all');
              setAssignedFilter('all');
              setOnlyMyApprovals(false);
              setHighRiskOnly(false);
              setPendingReviewOnly(false);
              setOverdueOnly(false);
              setEscalatedOnly(false);
              setDateFrom('');
            }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Modals ... (keep existing logic) */}
      <UploadModal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        onUpload={(payload) => {
          const p = typeof payload === 'string' ? ({ name: payload, docType: 'Invoice' } as UploadPayload) : payload;
          const id = `doc-${Math.random().toString(16).slice(2)}`;
          const amountByType: Record<string, number> = {
            Invoice: [8000, 25000, 45000, 85000, 120000, 280000][Math.floor(Math.random() * 6)],
            Bank: [15000, 55000, 120000, 400000][Math.floor(Math.random() * 4)],
            GST: [12000, 35000, 90000][Math.floor(Math.random() * 3)],
            Other: [5000, 30000, 75000][Math.floor(Math.random() * 3)],
          };
          const amount = amountByType[p.docType] ?? 25000;
          const vendor = p.vendor || 'Demo Vendor';
          const tenantId = activeWorkspace.id;

          const docForRisk = {
            id,
            tenantId,
            workspaceId: tenantId,
            amount,
            vendor,
            gst: 'NA',
            date: p.date || new Date().toISOString().slice(0, 10),
            docType: p.docType,
          };

          const riskResult = calculateRisk({
            document: docForRisk,
            rules,
            allTenantDocs: documents.map((d) => ({
              id: d.id,
              tenantId: d.workspaceId || d.tenant_id,
              amount: d.amount,
              vendor: d.vendor,
              gst: d.gst,
              date: d.date,
            })),
            tenantId,
          });

          const riskFields = riskResultToDocumentFields(riskResult);

          addDocument({
            id,
            workspaceId: activeWorkspace.id,
            name: p.name,
            docType: p.docType,
            vendor,
            amount,
            riskLevel: riskFields.riskLevel as any,
            riskScore: riskFields.riskScore,
            status: 'pending',
            createdBy: user?.email ?? null,
            date: p.date || new Date().toISOString().slice(0, 10),
            gst: 'NA',
            summary: riskFields.summary,
            issues: riskFields.issues,
            recommendations: riskFields.recommendations,
            mismatches: riskFields.mismatches,
            patternAlerts: riskFields.patternAlerts,
            riskSignals: riskFields.riskSignals,
            fileUrl: p.fileUrl,
          });
          push({ kind: 'success', title: 'Processed', message: 'Redirecting...' });
          navigate(`/document/${id}`);
        }}
      />

      <BulkApproveModal
        open={bulkApproveOpen}
        onClose={() => setBulkApproveOpen(false)}
        docs={selectedDocs}
        onConfirm={() => {
          const actorEmail = user?.email || '';
          const res = bulkApprove(selectedDocs.map((d) => d.id), actorEmail);
          if (!res.ok) {
            push({ kind: 'error', title: 'Bulk approve blocked', message: res.error });
            return;
          }
          push({ kind: 'success', title: 'Bulk approved', message: `${selectedDocs.length} documents approved.` });
          setSelected(new Set());
          setBulkApproveOpen(false);
        }}
      />

      <BulkRejectModal
        open={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        docs={selectedDocs}
        onConfirm={(note) => {
          const actorEmail = user?.email || '';
          const res = bulkReject(selectedDocs.map((d) => d.id), actorEmail, note);
          if (!res.ok) {
            push({ kind: 'error', title: 'Bulk reject blocked', message: res.error });
            return;
          }
          push({ kind: 'success', title: 'Bulk rejected', message: `${selectedDocs.length} documents rejected.` });
          setSelected(new Set());
          setBulkRejectOpen(false);
        }}
      />
    </div>
  );
}
