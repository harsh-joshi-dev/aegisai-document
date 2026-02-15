import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocument, type Document } from '../api/client';

function riskBadge(level: Document['riskLevel']) {
  if (level === 'Critical') return { label: 'CRITICAL', color: 'var(--error)' };
  if (level === 'Warning') return { label: 'WARNING', color: 'var(--warning)' };
  return { label: 'SAFE', color: 'var(--success)' };
}

export default function DocumentDetailsPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getDocument(id)
      .then((r) => setDoc(r.document))
      .catch((e: any) => setError(e?.message ?? 'Failed to load document'))
      .finally(() => setLoading(false));
  }, [id]);

  const highlights = useMemo(() => {
    const h = (doc?.metadata as any)?.financial?.riskHighlights;
    return Array.isArray(h) ? (h as string[]) : [];
  }, [doc?.metadata]);

  if (loading) {
    return (
      <div className="min-h-screen px-6 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">Loading...</div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen px-6 pt-24 pb-12">
        <div className="max-w-7xl mx-auto glass-panel">
          <h2 className="text-2xl" style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Unable to load document</h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>{error ?? 'Not found'}</p>
          <Link to="/dashboard" className="btn btn-secondary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const badge = riskBadge(doc.riskLevel);

  return (
    <div className="min-h-screen px-6 pt-24 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="text-4xl font-bold" style={{ color: 'var(--text-main)', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.filename}
            </h1>
            <p className="text-muted" style={{ marginBottom: 0 }}>
              Risk score: {typeof doc.riskScore === 'number' ? doc.riskScore : '—'}/100
            </p>
          </div>
          <div style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '999px',
            border: '1px solid var(--border-light)',
            color: badge.color,
            fontWeight: 800,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
          }}>
            {badge.label}
          </div>
        </div>

        <div className="flex" style={{ gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Link to={`/compare?docIds=${encodeURIComponent(doc.id)}`} className="btn btn-secondary">Compare</Link>
          <Link to={`/chat?documents=${encodeURIComponent(doc.id)}`} className="btn btn-secondary">Chat</Link>
          <Link to={`/reports?docIds=${encodeURIComponent(doc.id)}`} className="btn btn-primary">Generate Report</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel" style={{ gridColumn: 'span 2' as any }}>
            <h2 className="text-2xl" style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>Smart Summary</h2>
            <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 0 }}>
              {doc.summary ?? 'No summary generated yet.'}
            </pre>
          </div>

          <div className="glass-panel">
            <h2 className="text-2xl" style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>Extracted Data</h2>
            <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginBottom: 0 }}>
              {JSON.stringify(doc.extractedData ?? {}, null, 2)}
            </pre>
          </div>

          <div className="glass-panel" style={{ gridColumn: 'span 3' as any }}>
            <h2 className="text-2xl" style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>Risk Highlights</h2>
            {highlights.length === 0 ? (
              <p className="text-muted" style={{ marginBottom: 0 }}>No highlights available. Upload more related docs and run Compare for mismatch detection.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {highlights.map((h, idx) => (
                  <div key={idx} className="ds-card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Highlight</div>
                    <p className="text-muted" style={{ marginBottom: 0 }}>{h}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
