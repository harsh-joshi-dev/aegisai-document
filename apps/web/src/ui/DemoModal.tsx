import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

export function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content w-full max-w-3xl overflow-hidden p-0 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Watch Demo</p>
            <h2 className="mt-1 text-lg font-semibold text-white tracking-tight">How Aegis AI drives safer approvals</h2>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="bg-black/20 p-8 text-zinc-100 border-r border-white/5">
            <p className="text-sm font-bold text-indigo-400 mb-4">In 60 seconds you'll learn:</p>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-400">1</span>
                <span>What is risky (risk score + severity)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-400">2</span>
                <span>Why it is risky (mismatches + patterns)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-400">3</span>
                <span>What to do (recommended actions)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-400">4</span>
                <span>How approvals stay auditable</span>
              </li>
            </ul>
            <div className="mt-8 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-indigo-400 font-bold mb-2">Pro tip</p>
              <p className="text-sm text-indigo-300">Start with <span className="font-bold text-white">Critical</span> → then <span className="font-bold text-white">High</span>.</p>
            </div>
          </div>

          <div className="p-8">
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800/50 text-sm text-zinc-500">
              <div className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p>Demo video placeholder</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth" onClick={onClose} className="btn-primary flex-1 inline-flex items-center justify-center">
                Start Free Trial
              </Link>
              <button type="button" onClick={onClose} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
