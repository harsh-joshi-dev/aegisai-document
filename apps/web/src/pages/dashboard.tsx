import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDocument, getDocuments, type Document } from '../api/client';

function riskColor(level: Document['riskLevel']) {
  if (level === 'Critical') return 'var(--error)';
  if (level === 'Warning') return 'var(--warning)';
  return 'var(--success)';
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getDocuments();
      setDocuments(r.documents ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (doc: Document) => {
    const ok = window.confirm(`Delete "${doc.filename}"? This will remove the document and its processed chunks.`);
    if (!ok) return;
    try {
      await deleteDocument(doc.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete document');
    }
  };

  const summary = useMemo(() => {
    const critical = documents.filter((d) => d.riskLevel === 'Critical').length;
    const warning = documents.filter((d) => d.riskLevel === 'Warning').length;
    const normal = documents.filter((d) => d.riskLevel === 'Normal').length;
    const avgRiskScore = documents.length
      ? Math.round(
          documents.reduce((acc, d) => acc + (typeof d.riskScore === 'number' ? d.riskScore : 0), 0) / documents.length
        )
      : 0;
    return { critical, warning, normal, avgRiskScore };
  }, [documents]);

  if (loading) {
    return (
      <div className="min-h-screen px-6 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pt-24 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
              Dashboard
            </h1>
            <p className="text-muted">Catch financial mistakes before approval.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/upload" className="btn btn-primary">
              Upload Documents
            </Link>
            <Link to="/compare" className="btn btn-secondary">
              Compare
            </Link>
          </div>
        </div>

        {error && (
          <div className="glass-panel mb-8" style={{ borderColor: 'var(--error)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Error</strong>
            <p className="text-muted" style={{ marginBottom: 0 }}>
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel">
            <div className="text-muted">Risk Summary</div>
            <div className="flex items-center gap-4" style={{ marginTop: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--error)' }}>{summary.critical}</div>
                <div className="text-muted">Critical</div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{summary.warning}</div>
                <div className="text-muted">Warning</div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{summary.normal}</div>
                <div className="text-muted">Safe</div>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="text-muted">Average Risk Score</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
              {summary.avgRiskScore}
              <span className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>
                /100
              </span>
            </div>
            <div className="text-muted" style={{ marginBottom: 0 }}>
              Based on processed documents
            </div>
          </div>

          <div className="glass-panel">
            <div className="text-muted">Recent Activity</div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{documents.length}</div>
              <div className="text-muted" style={{ marginBottom: 0 }}>
                Documents uploaded
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
            <h2 className="text-2xl" style={{ marginBottom: 0, color: 'var(--text-main)' }}>
              Documents
            </h2>
            <Link to="/upload" className="btn btn-secondary btn-sm">
              Upload
            </Link>
          </div>

          {documents.length === 0 ? (
            <div className="text-muted">No documents yet. Upload invoices, bank statements, or GST files to begin.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {documents.slice(0, 9).map((d) => (
                <div key={d.id} className="ds-card" style={{ padding: '1rem' }}>
                  <div className="flex items-start justify-between" style={{ gap: '0.75rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.filename}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 0 }}>
                        Risk score: {typeof d.riskScore === 'number' ? d.riskScore : '—'}
                      </div>
                    </div>
                    <div style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-light)',
                      color: riskColor(d.riskLevel),
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                    }}>
                      {d.riskLevel.toUpperCase()}
                    </div>
                  </div>

                  <div className="flex" style={{ gap: '0.5rem', marginTop: '1rem' }}>
                    <Link to={`/document/${d.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                      View
                    </Link>
                    <Link to={`/compare?docIds=${encodeURIComponent(d.id)}`} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                      Compare
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, borderColor: 'rgba(239, 68, 68, 0.35)', color: 'var(--error)' }}
                      onClick={() => handleDelete(d)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
