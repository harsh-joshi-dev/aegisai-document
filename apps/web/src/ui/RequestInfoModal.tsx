import { FormEvent, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function RequestInfoModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (message: string) => void;
}) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onConfirm(message.trim());
    setMessage('');
    onClose();
  };

  const modal = (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Request Information</h2>
            <p className="mt-1 text-sm text-zinc-400">Send a message to the vendor/team and set status to Needs Info.</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Your request</label>
            <textarea
              className="ds-input min-h-[120px] resize-y"
              placeholder="What information do you need to approve this document?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Send Request</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
