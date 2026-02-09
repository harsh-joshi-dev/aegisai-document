import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedDocument } from '../api/client';
import './SharedDocumentPage.css';

export default function SharedDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof getSharedDocument>>['document'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setError('Invalid link');
      setLoading(false);
      return;
    }
    let cancelled = false;
    getSharedDocument(documentId)
      .then((res) => {
        if (!cancelled && res.success) setData(res.document);
        else if (!cancelled) setError('Document not available');
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? 'This shared document is not available or the link is invalid.' : 'Failed to load document.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [documentId]);

  const getRiskBadgeClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical': return 'risk-critical';
      case 'Warning': return 'risk-warning';
      default: return 'risk-normal';
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(undefined, { dateStyle: 'long' });
    } catch {
      return d;
    }
  };

  const confidenceDisplay = (v: number | null) => {
    if (v == null) return null;
    return typeof v === 'number' && v <= 1 ? `${Math.round(v * 100)}%` : `${v}%`;
  };

  if (loading) {
    return (
      <div className="shared-doc-page">
        <div className="shared-doc-loading">
          <div className="shared-doc-spinner" />
          <p>Loading shared document…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="shared-doc-page">
        <div className="shared-doc-error">
          <div className="shared-doc-error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1>Cannot open shared document</h1>
          <p>{error || 'Document not found.'}</p>
          <Link to="/" className="shared-doc-btn">Go to Aegis AI</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-doc-page">
      <header className="shared-doc-header">
        <Link to="/" className="shared-doc-logo">
          <svg className="shared-doc-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Aegis AI</span>
        </Link>
        <span className="shared-doc-badge-label">Shared document</span>
      </header>

      <main className="shared-doc-main">
        <div className="shared-doc-hero">
          <h1 className="shared-doc-title">{data.filename}</h1>
          <div className="shared-doc-meta-row">
            <span className={`shared-doc-risk-badge ${getRiskBadgeClass(data.riskLevel)}`}>
              {data.riskLevel}
            </span>
            <span className="shared-doc-date">Uploaded {formatDate(data.uploadedAt)}</span>
          </div>
        </div>

        <section className="shared-doc-section shared-doc-overview">
          <h2>Overview</h2>
          <div className="shared-doc-grid">
            <div className="shared-doc-card">
              <span className="shared-doc-card-label">Risk level</span>
              <span className={`shared-doc-card-value risk ${getRiskBadgeClass(data.riskLevel)}`}>{data.riskLevel}</span>
            </div>
            {data.riskCategory && data.riskCategory !== 'None' && (
              <div className="shared-doc-card">
                <span className="shared-doc-card-label">Category</span>
                <span className="shared-doc-card-value">{data.riskCategory}</span>
              </div>
            )}
            {data.riskConfidence != null && (
              <div className="shared-doc-card">
                <span className="shared-doc-card-label">Confidence</span>
                <span className="shared-doc-card-value">{confidenceDisplay(data.riskConfidence)}</span>
              </div>
            )}
          </div>
        </section>

        {(data.riskExplanation || data.riskLevel !== 'Normal') && (
          <section className="shared-doc-section">
            <h2>Why this status</h2>
            <div className="shared-doc-explanation">
              {data.riskExplanation || (
                data.riskLevel === 'Critical'
                  ? 'This document was classified as high risk. Professional review is recommended before taking action.'
                  : data.riskLevel === 'Warning'
                    ? 'Some concerns were detected. A quick review is recommended.'
                    : 'No significant risks were detected.'
              )}
            </div>
          </section>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <section className="shared-doc-section">
            <h2>Recommendations</h2>
            <ul className="shared-doc-recommendations">
              {data.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="shared-doc-footer">
          <p>Analyzed with <strong>Aegis AI</strong> — Intelligent Document Analysis</p>
          <Link to="/" className="shared-doc-footer-link">Open in Aegis AI</Link>
        </footer>
      </main>
    </div>
  );
}
