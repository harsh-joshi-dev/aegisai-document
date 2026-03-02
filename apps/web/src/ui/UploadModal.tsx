import { FormEvent, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud } from 'lucide-react';

export type UploadDocType = 'Invoice' | 'Bank' | 'GST' | 'Other';

export interface UploadPayload {
  name: string;
  file: File;
  fileName?: string;
  docType: UploadDocType;
  vendor?: string;
  date?: string;
}

export function UploadModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload?: (payload: UploadPayload) => void | Promise<void>;
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
    Promise.resolve(
      onUpload?.({
        name: finalName,
        file,
        fileName: file?.name,
        docType,
        vendor: vendor.trim() || undefined,
        date: date || undefined,
      })
    )
      .catch(() => {
        // keep modal open; parent will typically toast the error
      })
      .finally(() => {
        setName('');
        setVendor('');
        setDate('');
        setDocType('Invoice');
        setFile(null);
        setPhase('form');
        onClose();
      });
  };

  const modalMarkup = (
    <div
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
        padding: '24px',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '32px',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-xl), 0 0 0 1px var(--border-subtle)',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
              <UploadCloud size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-2xl font-bold text-main tracking-tight font-display">
                Upload Document
              </h2>
              <p className="mt-1 text-sm text-muted font-medium">Add a new document for risk analysis</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'processing'}
            aria-label="Close"
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <X size={16} />
          </button>
        </div>
        {phase === 'processing' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full" />
                <p className="text-sm font-semibold text-indigo-300">Processing document…</p>
              </div>
              <p className="text-sm text-muted">
                Extracting data, running rules + patterns, and calculating risk score.
              </p>
              <div className="mt-4 h-2 w-full rounded-full bg-subtle overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse" style={{ width: '66%' }} />
              </div>
            </div>
            <p className="text-xs text-dim">Uploading to backend and running analysis…</p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-main">Upload file</label>
              <input
                type="file"
                className="input w-full rounded-xl border border-subtle bg-subtle py-2.5 px-4 text-main file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-500 file:text-main hover:file:bg-indigo-600 file:cursor-pointer"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="mt-2 text-xs text-dim">PDF or image.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-main">Type</label>
                <select
                  className="input w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)] py-2.5 px-4 transition-colors focus:border-indigo-500/50 outline-none"
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
                <label className="mb-2 block text-sm font-medium text-main">Document name</label>
                <input
                  className="input w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)] placeholder:text-[var(--text-dim)] py-2.5 px-4 transition-colors focus:border-indigo-500/50 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={file?.name || 'Invoice_Jan_2026.pdf'}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-main">Vendor (optional)</label>
                <input
                  className="input w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)] placeholder:text-[var(--text-dim)] py-2.5 px-4 transition-colors focus:border-indigo-500/50 outline-none"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Nova Supplies Pvt Ltd"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-main">Date (optional)</label>
                <input
                  className="input w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)] py-2.5 px-4 transition-colors focus:border-indigo-500/50 outline-none"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
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
