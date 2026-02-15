import { FormEvent, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DocumentRecord } from '../mock/types';

export function BulkRejectModal({
  open,
  onClose,
  onConfirm,
  docs,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  docs: DocumentRecord[];
}) {
  const [note, setNote] = useState('');

  const summary = useMemo(() => {
    const safe = docs.filter((d) => d.riskLevel === 'Safe').length;
    const review = docs.filter((d) => d.riskLevel === 'Review Required').length;
    const high = docs.filter((d) => d.riskLevel === 'High').length;
    const critical = docs.filter((d) => d.riskLevel === 'Critical').length;
    return { safe, review, high, critical };
  }, [docs]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setNote('');
    onClose();
  };

  const modal = (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Bulk Rejection</h2>
            <p className="mt-1 text-sm text-zinc-400">Reject {docs.length} document{docs.length !== 1 ? 's' : ''}. A note is required for audit.</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-5">
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
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Rejection note (applied to all)</label>
            <textarea
              className="ds-input bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 h-32 pt-3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain why these documents are being rejected..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-danger">Reject {docs.length} document{docs.length !== 1 ? 's' : ''}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
