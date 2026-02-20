import { useState, useMemo } from 'react';
import { Search, Filter, Download, Clock, User, Globe, AlertCircle } from 'lucide-react';

interface AuditLog {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    resource: string;
    status: 'success' | 'failure' | 'warning';
    ipAddress: string;
    details: string;
}

const mockLogs: AuditLog[] = [
    { id: '1', timestamp: '2026-02-20T10:30:00Z', actor: 'admin@aegis.ai', action: 'Login', resource: 'Auth System', status: 'success', ipAddress: '192.168.1.1', details: 'Successful session initiation' },
    { id: '2', timestamp: '2026-02-20T11:15:00Z', actor: 'analyst@aegis.ai', action: 'Document Review', resource: 'INV-2024-001', status: 'success', ipAddress: '192.168.1.45', details: 'Risk level validated as Low' },
    { id: '3', timestamp: '2026-02-20T12:00:00Z', actor: 'system@aegis.ai', action: 'Anomaly Detection', resource: 'TXN-9982', status: 'warning', ipAddress: 'localhost', details: 'Potential duplicate invoice detected' },
    { id: '4', timestamp: '2026-02-20T12:45:00Z', actor: 'guest@external.com', action: 'Access Denied', resource: 'Admin Panel', status: 'failure', ipAddress: '45.12.98.2', details: 'Unauthorized access attempt' },
    { id: '5', timestamp: '2026-02-20T13:20:00Z', actor: 'admin@aegis.ai', action: 'Update Secret', resource: 'API Configuration', status: 'success', ipAddress: '192.168.1.1', details: 'Rotated production API keys' },
];

export default function AuditLogPage() {
    const [search, setSearch] = useState('');

    const filteredLogs = useMemo(() => {
        return mockLogs.filter(log =>
            log.actor.toLowerCase().includes(search.toLowerCase()) ||
            log.action.toLowerCase().includes(search.toLowerCase()) ||
            log.resource.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    return (
        <div className="w-full space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-subtle pb-8">
                <div>
                    <h1 className="text-4xl font-bold text-main tracking-tight">
                        Audit <span className="text-gradient">Logs</span>
                    </h1>
                    <p className="mt-3 text-base text-muted max-w-2xl leading-relaxed">
                        immutable record of all system activities. Tracking compliance, security events, and user interactions.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="btn-secondary">
                        <Download size={18} />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-primary transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search by actor, action, or resource..."
                        className="input-field pl-12 h-12"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button className="btn-secondary h-12 px-6">
                        <Filter size={18} className="mr-2" />
                        Advanced Filtering
                    </button>
                </div>
            </div>

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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {filteredLogs.map((log) => (
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
                                            <span className="text-sm font-semibold text-main">{log.actor}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className="text-sm font-bold text-main">{log.action}</span>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className="text-sm text-primary font-medium">{log.resource}</span>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {log.status === 'success' && <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />}
                                            {log.status === 'warning' && <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_var(--warning)]" />}
                                            {log.status === 'failure' && <div className="w-2 h-2 rounded-full bg-danger shadow-[0_0_8px_var(--danger)]" />}
                                            <span className={`text-xs font-bold uppercase tracking-wider ${log.status === 'success' ? 'text-success' :
                                                log.status === 'warning' ? 'text-warning' : 'text-danger'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted">
                                            <Globe size={12} />
                                            {log.ipAddress}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLogs.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center">
                            <AlertCircle size={48} className="text-dim mb-4" />
                            <p className="text-lg font-bold text-main">No logs found</p>
                            <p className="text-sm text-dim mt-1">Try refining your search or filters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
