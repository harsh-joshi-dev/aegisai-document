import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { generateAuditReport, getDocuments, type Document, type GenerateReportResponse } from '../api/client';

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get('docIds') || '').split(',').map((s) => s.trim()).filter(Boolean);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selected, setSelected] = useState<string[]>(initial);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateReportResponse | null>(null);

  useEffect(() => {
    setLoading(true);
    getDocuments()
      .then((r) => setDocuments(r.documents ?? []))
      .catch((e: any) => setError(e?.message ?? 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      searchParams.delete('docIds');
      setSearchParams(searchParams, { replace: true });
      return;
    }
    setSearchParams({ docIds: selected.join(',') }, { replace: true });
  }, [selected]);

  const canGenerate = selected.length >= 1;

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedDocs = useMemo(() => {
    const set = new Set(selected);
    return documents.filter((d) => set.has(d.id));
  }, [documents, selected]);

  const runReport = async () => {
    if (!canGenerate) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await generateAuditReport({ documentIds: selected });
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to generate report');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen px-6 pt-24 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold" style={{ color: 'var(--text-main)' }}>Reports</h1>
            <p className="text-muted">Generate an audit-ready summary report.</p>
          </div>
          <div className="flex" style={{ gap: '0.75rem' }}>
            <button className="btn btn-primary" disabled={!canGenerate || running} onClick={runReport}>
              {running ? 'Generating…' : 'Generate Report'}
            </button>
            <Link to="/compare" className="btn btn-secondary">Compare</Link>
          </div>
        </div>

        {error && (
          <div className="glass-panel mb-6" style={{ borderColor: 'var(--error)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Error</strong>
            <p className="text-muted" style={{ marginBottom: 0 }}>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel">
            <h2 className="text-2xl" style={{ color: 'var(--text-main)' }}>Select documents</h2>
            {loading ? (
              <p className="text-muted">Loading…</p>
            ) : documents.length === 0 ? (
              <p className="text-muted">No documents yet.</p>
            ) : (
              <div className="space-y-3" style={{ marginTop: '0.75rem' }}>
                {documents.map((d) => (
                  <label key={d.id} className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem' }}>
                    <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
                    <span style={{ color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ gridColumn: 'span 2' as any }}>
            <h2 className="text-2xl" style={{ color: 'var(--text-main)' }}>Audit Summary Report</h2>
            {!result ? (
              <div className="text-muted" style={{ marginTop: '0.75rem' }}>
                Select documents and click Generate Report.
              </div>
            ) : (
              <>
                <div className="text-muted" style={{ marginTop: '0.5rem' }}>
                  Report ID: {result.reportId ?? '—'}
                </div>
                <div className="ds-card" style={{ padding: '1rem', marginTop: '0.75rem' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginBottom: 0 }}>
                    {result.report}
                  </pre>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link to={`/chat?documents=${encodeURIComponent(selected.join(','))}`} className="btn btn-secondary">
                    Chat with these documents
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedDocs.length > 0 && (
          <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
            <h2 className="text-2xl" style={{ color: 'var(--text-main)' }}>Selected documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginTop: '0.75rem' }}>
              {selectedDocs.map((d) => (
                <div key={d.id} className="ds-card" style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{d.filename}</div>
                  <div className="text-muted" style={{ marginBottom: 0 }}>Risk score: {typeof d.riskScore === 'number' ? d.riskScore : '—'}</div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <Link to={`/document/${d.id}`} className="btn btn-secondary btn-sm">View</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
