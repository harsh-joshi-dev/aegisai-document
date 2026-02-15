import { DocumentStatus } from '../mock/types';

const statusStyles: Record<DocumentStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
  review_required: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]',
  pending_info: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  under_review: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  needs_info: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  archived: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 border-dashed',
};

const statusLabels: Record<DocumentStatus, string> = {
  pending: 'Pending',
  review_required: 'Review Required',
  pending_info: 'Pending Info',
  under_review: 'Under Review',
  needs_info: 'Needs Info',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider transition-colors ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
