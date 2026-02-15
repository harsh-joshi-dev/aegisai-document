import { FormEvent, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function SubmitInfoModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { comment: string; fileNames?: string[] }) => void;
}) {
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const fileNames = useMemo(() => files.map((f) => f.name), [files]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;
    onSubmit({ comment: trimmed, fileNames: fileNames.length ? fileNames : undefined });
    setComment('');
    setFiles([]);
    onClose();
  };

  if (!open) return null;

  const modal = (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content w-full max-w-lg p-6 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Submit Information</h2>
            <p className="mt-1 text-sm text-zinc-400">Attach missing information and send back for re-review.</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Attachment (optional)</label>
            <input
              type="file"
              className="ds-input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-500 file:text-white hover:file:bg-indigo-600 file:cursor-pointer"
              accept="application/pdf,image/*"
              multiple
              onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            <p className="mt-2 text-xs text-zinc-500">Filename is stored in the audit log.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Details or clarification</label>
            <textarea
              className="ds-input min-h-[120px] resize-y"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain what you changed or added..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Submit Information</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
