import { useState, useEffect } from 'react';
import { verifyDocument, VerificationResponse } from '../api/client';
import './DocumentVerification.css';

interface DocumentVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  filename: string;
}

export default function DocumentVerification({
  isOpen,
  onClose,
  documentId,
  filename,
}: DocumentVerificationProps) {
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<VerificationResponse['verification'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      handleVerify();
    } else {
      setVerification(null);
      setError(null);
    }
  }, [isOpen, documentId]);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    setVerification(null);

    try {
      const response = await verifyDocument({ documentId });
      setVerification(response.verification);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verified':
        return '#10b981'; // Green
      case 'Suspicious':
        return '#f59e0b'; // Amber
      case 'Fraudulent':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Verified':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Suspicious':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Fraudulent':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
    }
  };

  return (
    <div className="verification-overlay" onClick={onClose}>
      <div className="verification-container" onClick={(e) => e.stopPropagation()}>
        <div className="verification-header">
          <div className="verification-header-content">
            <svg className="verification-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Document Verification</h2>
          </div>
          <button className="verification-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="verification-content">
          <div className="verification-document-info">
            <h3>{filename}</h3>
          </div>

          {loading && (
            <div className="verification-loading">
              <div className="verification-spinner"></div>
              <p>Analyzing document for authenticity and fraud indicators...</p>
            </div>
          )}

          {error && (
            <div className="verification-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {error}
            </div>
          )}

          {verification && (
            <div className="verification-results">
              <div className="verification-status-card" style={{ borderColor: getStatusColor(verification.status) }}>
                <div className="status-header">
                  <div className="status-icon" style={{ color: getStatusColor(verification.status) }}>
                    {getStatusIcon(verification.status)}
                  </div>
                  <div className="status-info">
                    <h3 className="status-title">{verification.status}</h3>
                    <p className="status-subtitle">
                      {verification.isAuthentic ? 'Document appears authentic' : 'Document authenticity uncertain'}
                      {verification.isAuthorized ? ' • Authorized' : ' • Not authorized'}
                    </p>
                  </div>
                </div>
                <div className="status-scores">
                  <div className="score-item">
                    <span className="score-label">Fraud Score</span>
                    <span className={`score-value ${verification.fraudScore < 30 ? 'low' : verification.fraudScore < 50 ? 'medium' : 'high'}`}>
                      {verification.fraudScore}/100
                    </span>
                  </div>
                  <div className="score-item">
                    <span className="score-label">Confidence</span>
                    <span className="score-value">{verification.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="verification-checks">
                <h4>Verification Checks</h4>
                <div className="checks-grid">
                  <div className={`check-item ${verification.checks.metadata.passed ? 'passed' : 'failed'}`}>
                    <div className="check-header">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {verification.checks.metadata.passed ? (
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        )}
                      </svg>
                      <span className="check-name">Metadata</span>
                      <span className="check-score">{verification.checks.metadata.score}/100</span>
                    </div>
                    <p className="check-details">{verification.checks.metadata.details}</p>
                  </div>

                  <div className={`check-item ${verification.checks.integrity.passed ? 'passed' : 'failed'}`}>
                    <div className="check-header">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {verification.checks.integrity.passed ? (
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        )}
                      </svg>
                      <span className="check-name">Integrity</span>
                      <span className="check-score">{verification.checks.integrity.score}/100</span>
                    </div>
                    <p className="check-details">{verification.checks.integrity.details}</p>
                  </div>

                  <div className={`check-item ${verification.checks.signatures.passed ? 'passed' : 'failed'}`}>
                    <div className="check-header">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {verification.checks.signatures.passed ? (
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        )}
                      </svg>
                      <span className="check-name">Signatures</span>
                      <span className="check-score">{verification.checks.signatures.score}/100</span>
                    </div>
                    <p className="check-details">{verification.checks.signatures.details}</p>
                  </div>

                  <div className={`check-item ${verification.checks.consistency.passed ? 'passed' : 'failed'}`}>
                    <div className="check-header">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {verification.checks.consistency.passed ? (
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        )}
                      </svg>
                      <span className="check-name">Consistency</span>
                      <span className="check-score">{verification.checks.consistency.score}/100</span>
                    </div>
                    <p className="check-details">{verification.checks.consistency.details}</p>
                  </div>

                  <div className={`check-item ${verification.checks.patterns.passed ? 'passed' : 'failed'}`}>
                    <div className="check-header">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {verification.checks.patterns.passed ? (
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        )}
                      </svg>
                      <span className="check-name">Fraud Patterns</span>
                      <span className="check-score">{verification.checks.patterns.score}/100</span>
                    </div>
                    <p className="check-details">{verification.checks.patterns.details}</p>
                  </div>
                </div>
              </div>

              {verification.warnings.length > 0 && (
                <div className="verification-warnings">
                  <h4>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Warnings
                  </h4>
                  <ul>
                    {verification.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {verification.recommendations.length > 0 && (
                <div className="verification-recommendations">
                  <h4>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Recommendations
                  </h4>
                  <ul>
                    {verification.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!loading && !verification && !error && (
            <button className="verify-button" onClick={handleVerify}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Verify Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
