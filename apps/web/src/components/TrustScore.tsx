import { useState, useEffect } from 'react';
import { getTrustScore, TrustScoreResponse } from '../api/client';
import './TrustScore.css';

interface TrustScoreProps {
  documentId: string;
  documentName: string;
  isOpen?: boolean; // For modal mode
  onClose?: () => void;
  inline?: boolean; // If true, render inline instead of modal
}

export default function TrustScore({ documentId, documentName, isOpen, onClose, inline = false }: TrustScoreProps) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<TrustScoreResponse['analysis'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrustScore();
  }, [documentId]);

  const loadTrustScore = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTrustScore({ documentId });
      setAnalysis(response.analysis);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to calculate trust score');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Safe':
        return '#16a34a';
      case 'Needs Review':
        return '#ca8a04';
      case 'Dangerous':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#ca8a04';
    return '#dc2626';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="trust-score-loading">
          <div className="loading-spinner"></div>
          <p>Calculating trust score...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="trust-score-error">
          ⚠️ {error}
          <button onClick={loadTrustScore} className="retry-button">Retry</button>
        </div>
      );
    }

    if (!analysis) return null;

    return (
      <div className="trust-score-content">
        <div className="trust-score-header">
          <div className="score-display">
            <div className="score-circle" style={{ borderColor: getScoreColor(analysis.trustScore) }}>
              <span className="score-value" style={{ color: getScoreColor(analysis.trustScore) }}>
                {analysis.trustScore}
              </span>
              <span className="score-label">Trust Score</span>
            </div>
            <div className="status-badge" style={{ backgroundColor: getStatusColor(analysis.status) }}>
              {analysis.status}
            </div>
          </div>
        </div>

        <div className="trust-score-summary">
          <p>{analysis.summary}</p>
        </div>

        <div className="trust-factors">
          <h4>Trust Factors:</h4>
          <div className="factors-list">
            <div className="factor-item">
              <div className="factor-header">
                <span className="factor-name">Risk Level</span>
                <span className="factor-score" style={{ color: getScoreColor(analysis.factors.riskLevel.score) }}>
                  {analysis.factors.riskLevel.score}/100
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${analysis.factors.riskLevel.score}%`,
                    backgroundColor: getScoreColor(analysis.factors.riskLevel.score),
                  }}
                />
              </div>
              <div className="factor-details">
                {typeof analysis.factors.riskLevel.details === 'string'
                  ? analysis.factors.riskLevel.details
                  : analysis.factors.riskLevel.details.join(', ')}
              </div>
            </div>

            <div className="factor-item">
              <div className="factor-header">
                <span className="factor-name">Missing Clauses</span>
                <span className="factor-score" style={{ color: getScoreColor(analysis.factors.missingClauses.score) }}>
                  {analysis.factors.missingClauses.score}/100
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${analysis.factors.missingClauses.score}%`,
                    backgroundColor: getScoreColor(analysis.factors.missingClauses.score),
                  }}
                />
              </div>
              <div className="factor-details">
                {Array.isArray(analysis.factors.missingClauses.details)
                  ? analysis.factors.missingClauses.details.length > 0
                    ? analysis.factors.missingClauses.details.join(', ')
                    : 'No critical clauses missing'
                  : analysis.factors.missingClauses.details}
              </div>
            </div>

            <div className="factor-item">
              <div className="factor-header">
                <span className="factor-name">Unusual Patterns</span>
                <span className="factor-score" style={{ color: getScoreColor(analysis.factors.unusualPatterns.score) }}>
                  {analysis.factors.unusualPatterns.score}/100
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${analysis.factors.unusualPatterns.score}%`,
                    backgroundColor: getScoreColor(analysis.factors.unusualPatterns.score),
                  }}
                />
              </div>
              <div className="factor-details">
                {Array.isArray(analysis.factors.unusualPatterns.details)
                  ? analysis.factors.unusualPatterns.details.length > 0
                    ? analysis.factors.unusualPatterns.details.join(', ')
                    : 'No unusual patterns detected'
                  : analysis.factors.unusualPatterns.details}
              </div>
            </div>

            <div className="factor-item">
              <div className="factor-header">
                <span className="factor-name">Ambiguous Language</span>
                <span className="factor-score" style={{ color: getScoreColor(analysis.factors.ambiguousLanguage.score) }}>
                  {analysis.factors.ambiguousLanguage.score}/100
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${analysis.factors.ambiguousLanguage.score}%`,
                    backgroundColor: getScoreColor(analysis.factors.ambiguousLanguage.score),
                  }}
                />
              </div>
              <div className="factor-details">
                {Array.isArray(analysis.factors.ambiguousLanguage.details)
                  ? analysis.factors.ambiguousLanguage.details.length > 0
                    ? analysis.factors.ambiguousLanguage.details.join(', ')
                    : 'Language is clear and unambiguous'
                  : analysis.factors.ambiguousLanguage.details}
              </div>
            </div>

            <div className="factor-item">
              <div className="factor-header">
                <span className="factor-name">Expiry/Outdated Terms</span>
                <span className="factor-score" style={{ color: getScoreColor(analysis.factors.expiryOrOutdated.score) }}>
                  {analysis.factors.expiryOrOutdated.score}/100
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${analysis.factors.expiryOrOutdated.score}%`,
                    backgroundColor: getScoreColor(analysis.factors.expiryOrOutdated.score),
                  }}
                />
              </div>
              <div className="factor-details">
                {typeof analysis.factors.expiryOrOutdated.details === 'string'
                  ? analysis.factors.expiryOrOutdated.details
                  : analysis.factors.expiryOrOutdated.details.join(', ')}
              </div>
            </div>
          </div>
        </div>

        {analysis.recommendations.length > 0 && (
          <div className="trust-recommendations">
            <h4>💡 Recommendations:</h4>
            <ul>
              {analysis.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  if (inline) {
    return (
      <div className="trust-score-inline">
        {renderContent()}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="trust-score-overlay" onClick={onClose}>
      <div className="trust-score-container" onClick={(e) => e.stopPropagation()}>
        <div className="trust-score-modal-header">
          <h2>📊 Document Trust Score™</h2>
          {onClose && (
            <button className="trust-score-close" onClick={onClose}>×</button>
          )}
        </div>
        <div className="trust-score-modal-content">
          <div className="document-name-header">📄 {documentName}</div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
