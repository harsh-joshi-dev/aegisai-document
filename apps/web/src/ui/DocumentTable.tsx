import { Link } from 'react-router-dom';
import { DocumentRecord } from '../mock/types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { Eye, Archive, RotateCcw, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function DocumentTable({
  documents,
  selectedIds,
  onToggle,
  onToggleAll,
  isRowSelectable,
  onArchive,
  onRestore,
  onDelete,
  showWorkflowColumns,
}: {
  documents: DocumentRecord[];
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  isRowSelectable?: (doc: DocumentRecord) => boolean;
  onArchive?: (doc: DocumentRecord) => void;
  onRestore?: (doc: DocumentRecord) => void;
  onDelete?: (doc: DocumentRecord) => void | Promise<void>;
  showWorkflowColumns?: boolean;
}) {
  const now = Date.now();

  const selectable = !!selectedIds && !!onToggle && !!onToggleAll;
  const selectableDocs = selectable
    ? documents.filter((d) => (isRowSelectable ? isRowSelectable(d) : true))
    : [];

  const allSelected =
    selectable && selectableDocs.length > 0 && selectableDocs.every((d) => selectedIds.has(d.id));

  return (
    <div className="rounded-[20px] bg-card border border-subtle overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-subtle bg-subtle">
              {selectable && (
                <th className="px-6 py-4 w-12">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!!allSelected}
                      onChange={onToggleAll}
                      className="h-4 w-4 rounded border-subtle bg-card text-indigo-500 focus:ring-indigo-500/20 focus:ring-offset-0 cursor-pointer transition-colors"
                      aria-label="Select all"
                    />
                  </div>
                </th>
              )}
              <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Document</th>
              {showWorkflowColumns && <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Type</th>}
              <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Vendor</th>
              <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Amount</th>
              <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Risk Level</th>
              <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Status</th>
              {showWorkflowColumns && <th className="px-6 py-4 font-semibold text-[var(--text-muted)]">Assigned To</th>}
              <th className="px-6 py-4 font-semibold text-[var(--text-muted)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {documents.map((doc) => {
              const isOverdue = !doc.escalatedAt && doc.slaDueAt && new Date(doc.slaDueAt).getTime() < now;
              const isEscalated = !!doc.escalatedAt;

              return (
                <tr
                  key={doc.id}
                  className="group hover:bg-card-hover transition-colors duration-200"
                >
                  {selectable && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        disabled={isRowSelectable ? !isRowSelectable(doc) : false}
                        onChange={() => onToggle(doc.id)}
                        className="h-4 w-4 rounded border-subtle bg-card text-indigo-500 focus:ring-indigo-500/20 focus:ring-offset-0 cursor-pointer disabled:opacity-50 transition-colors"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-main group-hover:text-indigo-500 transition-colors">{doc.name}</span>
                      <span className="text-xs text-muted mt-0.5">{format(new Date(doc.date), 'MMM d, yyyy')}</span>
                    </div>
                  </td>
                  {showWorkflowColumns && (
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-subtle border border-subtle text-xs font-medium text-muted">
                        {doc.docType || '—'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-muted font-medium">{doc.vendor}</td>
                  <td className="px-6 py-4 font-mono text-muted">₹{doc.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4">
                    <RiskBadge level={doc.riskLevel} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={doc.status} />
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20" title="SLA Breached">
                          <Clock size={12} /> Overdue
                        </div>
                      )}
                      {isEscalated && (
                        <div className="flex items-center gap-1 text-red-500 text-xs font-medium bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20" title="Escalated to admin">
                          <AlertTriangle size={12} /> Escalated
                        </div>
                      )}
                    </div>
                  </td>
                  {showWorkflowColumns && (
                    <td className="px-6 py-4 text-sm">
                      {doc.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 ring-1 ring-indigo-500/30">
                            {doc.assignedTo[0].toUpperCase()}
                          </div>
                          <span className="text-muted">{doc.assignedTo.split('@')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-dim italic">Unassigned</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/document/${doc.id}`}
                        className="p-2 rounded-lg text-muted hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </Link>

                      {onArchive && (doc.status === 'approved' || doc.status === 'rejected') && (
                        <button
                          onClick={() => onArchive(doc)}
                          className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Archive"
                        >
                          <Archive size={18} />
                        </button>
                      )}

                      {onRestore && doc.status === 'archived' && (
                        <button
                          onClick={() => onRestore(doc)}
                          className="p-2 rounded-lg text-muted hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          title="Restore"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}

                      {onDelete && (
                        <button
                          onClick={() => onDelete(doc)}
                          className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
