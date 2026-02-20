import { FormEvent, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function RejectModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    onConfirm(notes.trim());
    setNotes('');
    onClose();
  };

  if (!open) return null;

  const modal = (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content w-full max-w-lg p-6 bg-[#121214] border border-subtle rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-main tracking-tight">Reject Document</h2>
            <p className="mt-1 text-sm text-muted">Rejection notes are required for audit traceability.</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-main">Rejection reason</label>
            <textarea
              className="ds-input min-h-[120px] resize-y"
              placeholder="Explain why this document is being rejected..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-danger">Confirm Rejection</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
