import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`modal-content w-full ${maxWidth} p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 id="modal-title" className="text-xl font-semibold text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
