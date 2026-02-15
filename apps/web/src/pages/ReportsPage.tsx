import { FileBarChart, TrendingUp, AlertCircle, Download, Calendar, BarChart3, PieChart, ArrowUpRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMockStore } from '../state/mockStore';
import { useWorkspace } from '../state/workspace';
import { useToast } from '../state/toast';
import { format } from 'date-fns';

const reportCardTemplates = [
  { title: 'Weekly Risk Summary', icon: FileBarChart, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', glow: 'group-hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]' },
  { title: 'Approval Quality', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]' },
  { title: 'Open Exceptions', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'group-hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]' },
];

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [reportHistory, setReportHistory] = useState<{ name: string; date: string; type: string; size: string }[]>([]);
  const { documents } = useMockStore();
  const { activeWorkspace } = useWorkspace();
  const { push } = useToast();

  const workspaceDocs = useMemo(
    () => documents.filter((d) => d.workspaceId === activeWorkspace.id),
    [documents, activeWorkspace.id]
  );

  const filteredDocs = useMemo(
    () => workspaceDocs.filter((d) => d.date >= dateFrom && d.date <= dateTo),
    [workspaceDocs, dateFrom, dateTo]
  );

  const reportMetrics = useMemo(() => {
    const total = filteredDocs.length;
    const approved = filteredDocs.filter((d) => d.status === 'approved').length;
    const rejected = filteredDocs.filter((d) => d.status === 'rejected').length;
    const escalated = filteredDocs.filter((d) => !!d.escalatedAt).length;
    const highRisk = filteredDocs.filter((d) => d.riskLevel === 'High' || d.riskLevel === 'Critical').length;
    const approvalRate = approved + rejected > 0 ? Math.round((approved / (approved + rejected)) * 100) : null;
    const escalationRate = total > 0 ? Math.round((escalated / total) * 100) : 0;
    return {
      total,
      approved,
      rejected,
      escalated,
      highRisk,
      approvalRate,
      escalationRate,
      safe: filteredDocs.filter((d) => d.riskLevel === 'Safe').length,
      review: filteredDocs.filter((d) => d.riskLevel === 'Review Required').length,
    };
  }, [filteredDocs]);

  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const generatePDF = () => {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Risk Report ${dateFrom} - ${dateTo}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#333;max-width:800px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:8px}
.meta{color:#666;font-size:0.875rem;margin-bottom:24px}
table{width:100%;border-collapse:collapse;font-size:0.875rem}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e5e5e5}
th{background:#f5f5f5;font-weight:600}
.summary{margin-top:24px;padding:16px;background:#f9f9f9;border-radius:8px;font-size:0.875rem}
</style>
</head>
<body>
<h1>Risk Report</h1>
<p class="meta">Workspace: ${activeWorkspace.name} · ${dateFrom} to ${dateTo} · Generated ${format(new Date(), 'PPpp')}</p>
<table>
<thead><tr><th>Document</th><th>Vendor</th><th>Amount</th><th>Risk</th><th>Status</th><th>Date</th></tr></thead>
<tbody>
${filteredDocs
  .map(
    (d) =>
      `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.vendor)}</td><td>₹${d.amount?.toLocaleString('en-IN') ?? '—'}</td><td>${d.riskLevel} (${d.riskScore})</td><td>${d.status}</td><td>${d.date}</td></tr>`
  )
  .join('')}
</tbody>
</table>
<div class="summary">
<strong>Summary:</strong> ${filteredDocs.length} documents in date range. 
Safe: ${filteredDocs.filter((d) => d.riskLevel === 'Safe').length}, 
Review: ${filteredDocs.filter((d) => d.riskLevel === 'Review Required').length}, 
High: ${filteredDocs.filter((d) => d.riskLevel === 'High').length}, 
Critical: ${filteredDocs.filter((d) => d.riskLevel === 'Critical').length}
</div>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      push({ kind: 'error', title: 'Popup blocked', message: 'Allow popups to generate PDF.' });
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
    setReportHistory((prev) => [
      ...prev,
      { name: `Risk Report ${dateFrom} - ${dateTo}`, date: format(new Date(), 'PP'), type: 'PDF', size: '—' },
    ]);
    push({ kind: 'success', title: 'Report generated', message: 'Use Save as PDF in the print dialog.' });
  };

  const exportCSV = () => {
    const headers = ['Name', 'Vendor', 'Amount', 'Date', 'Risk Level', 'Risk Score', 'Status', 'Summary'];
    const rows = filteredDocs.map((d) =>
      [d.name, d.vendor, d.amount, d.date, d.riskLevel, d.riskScore, d.status, (d.summary || '').replace(/"/g, '""')].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `risk_report_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setReportHistory((prev) => [
      ...prev,
      { name: `Risk Report ${dateFrom} - ${dateTo}`, date: format(new Date(), 'PP'), type: 'CSV', size: `${(blob.size / 1024).toFixed(1)} KB` },
    ]);
    push({ kind: 'success', title: 'CSV exported', message: `${filteredDocs.length} documents exported.` });
  };

  return (
    <div className="w-full min-h-full space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Reports</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">
            Audit-ready report snapshots for decision tracking, compliance, and analytics.
          </p>
        </div>
      </div>

      {/* Report Cards – Risk trends, Approval quality, Escalation rate */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className={`group card-premium p-6 transition-all duration-300 hover:-translate-y-1 ${reportCardTemplates[0].glow}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className={`p-2.5 rounded-xl ${reportCardTemplates[0].bg} ${reportCardTemplates[0].color}`}>
              <FileBarChart size={20} />
            </div>
            <ArrowUpRight size={16} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-display font-bold text-white mb-1">{reportMetrics.total} docs</p>
          <p className="text-sm font-medium text-zinc-300 mb-1">Weekly Risk Summary</p>
          <p className="text-xs text-zinc-500">
            Safe: {reportMetrics.safe} · Review: {reportMetrics.review} · High/Critical: {reportMetrics.highRisk}
          </p>
        </div>
        <div className={`group card-premium p-6 transition-all duration-300 hover:-translate-y-1 ${reportCardTemplates[1].glow}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className={`p-2.5 rounded-xl ${reportCardTemplates[1].bg} ${reportCardTemplates[1].color}`}>
              <TrendingUp size={20} />
            </div>
            <ArrowUpRight size={16} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-display font-bold text-white mb-1">
            {reportMetrics.approvalRate != null ? `${reportMetrics.approvalRate}%` : '—'}
          </p>
          <p className="text-sm font-medium text-zinc-300 mb-1">Approval Quality</p>
          <p className="text-xs text-zinc-500">
            {reportMetrics.approved} approved, {reportMetrics.rejected} rejected in range
          </p>
        </div>
        <div className={`group card-premium p-6 transition-all duration-300 hover:-translate-y-1 ${reportCardTemplates[2].glow}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className={`p-2.5 rounded-xl ${reportCardTemplates[2].bg} ${reportCardTemplates[2].color}`}>
              <AlertCircle size={20} />
            </div>
            <ArrowUpRight size={16} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-display font-bold text-white mb-1">{reportMetrics.escalated}</p>
          <p className="text-sm font-medium text-zinc-300 mb-1">Open Exceptions</p>
          <p className="text-xs text-zinc-500">
            Escalated in range · {reportMetrics.escalationRate}% escalation rate
          </p>
        </div>
      </div>

      {/* Generate Report */}
      <div className="card-premium p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Generate Custom Report</h2>
            <p className="text-xs text-zinc-500">Select date range and export format for an audit-ready report</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input
                type="date"
                className="input-field pl-9 w-[170px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
          </div>
          <div className="pb-[10px] text-zinc-600">→</div>
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input
                type="date"
                className="input-field pl-9 w-[170px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={generatePDF} className="btn-primary h-[42px] shadow-lg shadow-indigo-500/20">
              <PieChart size={16} className="mr-2" />
              Generate PDF
            </button>
            <button type="button" onClick={exportCSV} className="btn-secondary h-[42px]">
              <Download size={16} className="mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Report History */}
      <div className="card-premium overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="font-display text-lg font-bold text-white">Report History</h2>
          <p className="text-xs text-zinc-500 mt-1">Previously generated reports available for download</p>
        </div>
        <div className="divide-y divide-white/5">
          {reportHistory.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500">
              <FileBarChart size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No reports generated yet.</p>
              <p className="text-xs mt-1">Use the form above to generate your first report.</p>
            </div>
          ) : reportHistory.map((report, i) => (
            <div key={i} className="group flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-white/5 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors">
                  <FileBarChart size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{report.name}</p>
                  <p className="text-xs text-zinc-500">{report.date} · {report.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${report.type === 'PDF'
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                  {report.type}
                </span>
                <button
                  type="button"
                  onClick={() => { if (report.type === 'CSV') exportCSV(); else generatePDF(); }}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
