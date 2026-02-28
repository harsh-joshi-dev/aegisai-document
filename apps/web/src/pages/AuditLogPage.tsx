import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, Download, Clock, User, Globe, AlertCircle, ChevronLeft, ChevronRight, X, RefreshCw, Shield } from 'lucide-react';
import { getAuditLogs, type AuditLogItem } from '../api/client';

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'document_upload', label: 'Document Upload' },
  { value: 'document_approved', label: 'Document Approved' },
  { value: 'document_rejected', label: 'Document Rejected' },
  { value: 'document_info_requested', label: 'Info Requested' },
  { value: 'document_deleted', label: 'Document Deleted' },
  { value: 'folder_created', label: 'Folder Created' },
  { value: 'vendor_link_created', label: 'Vendor Link Created' },
  { value: 'gdpr_export', label: 'GDPR Export' },
  { value: 'gdpr_delete', label: 'GDPR Delete' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'document', label: 'Documents' },
  { value: 'folder', label: 'Folders' },
  { value: 'rule', label: 'Rules' },
  { value: 'vendor_link', label: 'Vendor Links' },
  { value: 'user', label: 'Users' },
  { value: 'workspace', label: 'Workspace' },
];

function getStatusFromAction(action: string): 'success' | 'warning' | 'failure' {
  if (action.includes('rejected') || action.includes('deleted') || action.includes('failed')) return 'failure';
  if (action.includes('request') || action.includes('warning') || action.includes('flagged')) return 'warning';
  return 'success';
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: PAGE_SIZE, offset };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resourceType = resourceFilter;
      const res = await getAuditLogs(params);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter, resourceFilter]);

  useEffect(() => {
    setPage(0);
    fetchLogs(0);
  }, [fetchLogs]);

  useEffect(() => {
    fetchLogs(page * PAGE_SIZE);
  }, [page, fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs(page * PAGE_SIZE);
  };

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(log =>
      (log.userEmail || '').toLowerCase().includes(q) ||
      (log.userName || '').toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.resourceType.toLowerCase().includes(q) ||
      (log.resourceId || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportCSV = useCallback(() => {
    const headers = ['Timestamp', 'Actor', 'Email', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Compliance Flags', 'Details'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.userName || '—',
      log.userEmail || '—',
      log.action,
      log.resourceType,
      log.resourceId || '—',
      log.ipAddress || '—',
      (log.complianceFlags || []).join('; '),
      JSON.stringify(log.details || {}),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aegis_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filteredLogs]);

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-subtle pb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Shield size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-dim">Compliance</span>
          </div>
          <h1 className="text-4xl font-bold text-main tracking-tight">
            Audit <span className="text-gradient">Logs</span>
          </h1>
          <p className="mt-3 text-base text-muted max-w-2xl leading-relaxed">
            Immutable record of all system activities. Track compliance, security events, and user interactions in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="btn-secondary h-10 px-4"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <div className="ml-2">
            Refresh
              
            </div>
          </button>
          <button onClick={exportCSV} className="btn-secondary h-10 px-4">
            <Download size={16} />
            <div className="ml-2">
            Export CSV
            </div>
     
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-primary transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by actor, action, or resource..."
            className="input-field pl-12 h-12 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-dim hover:text-main transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            className={`btn-secondary h-12 px-6 ${showFilters ? 'ring-1 ring-indigo-500/50 text-indigo-400' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} className="mr-2" />
            Filters {(actionFilter || resourceFilter) && (
              <span className="ml-2 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">
                {(actionFilter ? 1 : 0) + (resourceFilter ? 1 : 0)}
              </span>
            )}
          </button>
          <div className="text-xs text-dim font-medium">
            {total.toLocaleString()} total records
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Action</label>
            <select
              className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none min-w-[180px]"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Resource Type</label>
            <select
              className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none min-w-[180px]"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
            >
              {RESOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {(actionFilter || resourceFilter) && (
            <div className="flex items-end">
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold py-2"
                onClick={() => { setActionFilter(''); setResourceFilter(''); }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-subtle bg-subtle/50">
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">Actor</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">Action</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">Resource</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">IP Address</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-dim">Loading audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center">
                      <AlertCircle size={48} className="text-dim mb-4" />
                      <p className="text-lg font-bold text-main">No logs found</p>
                      <p className="text-sm text-dim mt-1">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.map((log) => {
                const status = getStatusFromAction(log.action);
                const actionLabel = log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <tr key={log.id} className="hover:bg-subtle/30 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm font-medium text-main">
                        <Clock size={14} className="text-dim" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center border border-subtle">
                          <User size={14} className="text-muted" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-main block">{log.userName || 'System'}</span>
                          {log.userEmail && (
                            <span className="text-[11px] text-dim">{log.userEmail}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className="text-sm font-bold text-main">{actionLabel}</span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div>
                        <span className="text-xs text-dim uppercase tracking-wider">{log.resourceType}</span>
                        {log.resourceId && (
                          <span className="text-xs text-primary font-mono block mt-0.5">{log.resourceId.slice(0, 12)}...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {status === 'success' && <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />}
                        {status === 'warning' && <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_var(--warning)]" />}
                        {status === 'failure' && <div className="w-2 h-2 rounded-full bg-danger shadow-[0_0_8px_var(--danger)]" />}
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          status === 'success' ? 'text-success' :
                          status === 'warning' ? 'text-warning' : 'text-danger'
                        }`}>
                          {status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-mono text-muted">
                        <Globe size={12} />
                        {log.ipAddress || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {(log.complianceFlags || []).map((flag, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold uppercase">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-subtle bg-subtle/30">
            <div className="text-xs text-dim">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary h-8 px-3 text-xs"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + i;
                  return (
                    <button
                      key={pageNum}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        pageNum === page
                          ? 'bg-indigo-500 text-white'
                          : 'text-dim hover:text-main hover:bg-white/5'
                      }`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>
              <button
                className="btn-secondary h-8 px-3 text-xs"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
