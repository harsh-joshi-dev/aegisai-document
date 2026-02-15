import { FormEvent, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud } from 'lucide-react';

export type UploadDocType = 'Invoice' | 'Bank' | 'GST' | 'Other';

export interface UploadPayload {
  name: string;
  fileName?: string;
  docType: UploadDocType;
  vendor?: string;
  date?: string;
  /** Base64 data URL for PDF/image preview */
  fileUrl?: string;
}

export function UploadModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload?: (payload: string | UploadPayload) => void;
}) {
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [docType, setDocType] = useState<UploadDocType>('Invoice');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'form' | 'processing'>('form');

  const inferredName = useMemo(() => {
    const base = name.trim();
    if (base) return base;
    return file?.name || '';
  }, [name, file?.name]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase === 'form') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, phase, onClose]);

  // Lock body scroll when modal is open so overlay is clearly on top
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalName = inferredName.trim();
    if (!finalName || !file) return;

    setPhase('processing');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      window.setTimeout(() => {
        onUpload?.({
          name: finalName,
          fileName: file?.name,
          docType,
          vendor: vendor.trim() || undefined,
          date: date || undefined,
          fileUrl: dataUrl,
        });
        setName('');
        setVendor('');
        setDate('');
        setDocType('Invoice');
        setFile(null);
        setPhase('form');
        onClose();
      }, 1200);
    };
    reader.readAsDataURL(file);
  };

  const modalMarkup = (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      onClick={(e) => e.target === e.currentTarget && phase === 'form' && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="modal-content w-full max-w-lg p-6 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
              <UploadCloud size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-xl font-semibold text-white tracking-tight">
                Upload Document
              </h2>
              <p className="mt-0.5 text-sm text-zinc-400">Add a new document for risk analysis</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'processing'}
            className="modal-close shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {phase === 'processing' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full" />
                <p className="text-sm font-semibold text-indigo-300">Processing document…</p>
              </div>
              <p className="text-sm text-zinc-400">
                Extracting data, running rules + patterns, and calculating risk score.
              </p>
              <div className="mt-4 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse" style={{ width: '66%' }} />
              </div>
            </div>
            <p className="text-xs text-zinc-500">Mock processing (no backend).</p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Upload file</label>
              <input
                type="file"
                className="input w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-500 file:text-white hover:file:bg-indigo-600 file:cursor-pointer"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="mt-2 text-xs text-zinc-500">PDF or image (mock processing).</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Type</label>
                <select
                  className="input w-full rounded-xl border border-white/10 bg-white/5 text-white py-2.5 px-4"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as UploadDocType)}
                >
                  <option value="Invoice">Invoice</option>
                  <option value="Bank">Bank</option>
                  <option value="GST">GST</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Document name</label>
                <input
                  className="input w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-zinc-500 py-2.5 px-4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={file?.name || 'Invoice_Jan_2026.pdf'}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Vendor (optional)</label>
                <input
                  className="input w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-zinc-500 py-2.5 px-4"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Nova Supplies Pvt Ltd"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Date (optional)</label>
                <input
                  className="input w-full rounded-xl border border-white/10 bg-white/5 text-white py-2.5 px-4"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Upload & Analyze
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (!open) return null;
  return createPortal(modalMarkup, document.body);
}
