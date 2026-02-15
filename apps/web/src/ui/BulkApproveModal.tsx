import { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DocumentRecord } from '../mock/types';

export function BulkApproveModal({
  open,
  onClose,
  onConfirm,
  docs,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  docs: DocumentRecord[];
}) {
  const summary = useMemo(() => {
    const safe = docs.filter((d) => d.riskLevel === 'Safe').length;
    const review = docs.filter((d) => d.riskLevel === 'Review Required').length;
    const high = docs.filter((d) => d.riskLevel === 'High').length;
    const critical = docs.filter((d) => d.riskLevel === 'Critical').length;
    return { safe, review, high, critical };
  }, [docs]);

  const blocked = summary.critical > 0;

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content w-full max-w-lg p-6 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Confirm Bulk Approval</h2>
            <p className="mt-1 text-sm text-zinc-400">You are about to approve {docs.length} document{docs.length !== 1 ? 's' : ''}.</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-zinc-300 mb-3">Risk Summary</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-xs text-emerald-400 mb-1">Safe</p>
              <p className="text-2xl font-bold text-emerald-300">{summary.safe}</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-400 mb-1">Review</p>
              <p className="text-2xl font-bold text-amber-300">{summary.review}</p>
            </div>
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
              <p className="text-xs text-orange-400 mb-1">High</p>
              <p className="text-2xl font-bold text-orange-300">{summary.high}</p>
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs text-red-400 mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-300">{summary.critical}</p>
            </div>
          </div>

          {blocked ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-400 font-medium">
                ⚠️ Bulk approval is blocked because the selection contains <span className="font-bold">Critical</span> risk documents.
                Approve Critical documents individually.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={blocked}>
            Approve {docs.length} document{docs.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
