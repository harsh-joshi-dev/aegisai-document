import { useState, useEffect } from 'react';
import { checkDocumentCompleteness, CompletenessResponse } from '../api/client';
import './DocumentCompleteness.css';

interface DocumentCompletenessProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  filename: string;
}

export default function DocumentCompleteness({
  isOpen,
  onClose,
  documentId,
  filename,
}: DocumentCompletenessProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CompletenessResponse['analysis'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      handleCheck();
    } else {
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen, documentId]);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await checkDocumentCompleteness({ documentId });
      setAnalysis(response.analysis);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Completeness check failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete':
        return '#10b981'; // Green
      case 'Mostly Complete':
        return '#3b82f6'; // Blue
      case 'Incomplete':
        return '#f59e0b'; // Amber
      case 'Very Incomplete':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return '#ef4444';
      case 'High':
        return '#f59e0b';
      case 'Medium':
        return '#3b82f6';
      case 'Low':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'High':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
    }
  };

  return (
    <div className="completeness-overlay" onClick={onClose}>
      <div className="completeness-container" onClick={(e) => e.stopPropagation()}>
        <div className="completeness-header">
          <div className="completeness-header-content">
            <svg className="completeness-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Document Completeness Check</h2>
          </div>
          <button className="completeness-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="completeness-content">
          <div className="completeness-document-info">
            <h3>{filename}</h3>
          </div>

          {loading && (
            <div className="completeness-loading">
              <div className="completeness-spinner"></div>
              <p>Analyzing document for missing elements...</p>
            </div>
          )}

          {error && (
            <div className="completeness-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {error}
            </div>
          )}

          {analysis && (
            <div className="completeness-results">
              <div className="completeness-status-card" style={{ borderColor: getStatusColor(analysis.overallStatus) }}>
                <div className="status-header">
                  <div className="status-score-circle" style={{ borderColor: getStatusColor(analysis.overallStatus) }}>
                    <span className="score-value">{analysis.completenessScore}</span>
                    <span className="score-label">%</span>
                  </div>
                  <div className="status-info">
                    <h3 className="status-title">{analysis.overallStatus}</h3>
                    <p className="status-subtitle">{analysis.summary}</p>
                  </div>
                </div>
              </div>

              {analysis.missingElements.length > 0 ? (
                <>
                  <div className="missing-elements-section">
                    <h4>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Missing Elements ({analysis.missingElements.length})
                    </h4>
                    <div className="missing-elements-list">
                      {analysis.missingElements.map((element, index) => (
                        <div key={index} className="missing-element-item">
                          <div className="element-header">
                            <div className="element-priority" style={{ color: getPriorityColor(element.priority) }}>
                              {getPriorityIcon(element.priority)}
                              <span className="priority-label">{element.priority}</span>
                            </div>
                            <div className="element-category">{element.category}</div>
                          </div>
                          <h5 className="element-name">{element.item}</h5>
                          <p className="element-description">{element.description}</p>
                          <p className="element-reason">{element.reason}</p>
                          {element.suggestion && (
                            <div className="element-suggestion">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span>{element.suggestion}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {analysis.recommendations.length > 0 && (
                    <div className="recommendations-section">
                      <h4>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Recommendations
                      </h4>
                      <ul className="recommendations-list">
                        {analysis.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="complete-message">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h4>Document is Complete!</h4>
                  <p>All expected elements are present in this document.</p>
                </div>
              )}
            </div>
          )}

          {!loading && !analysis && !error && (
            <button className="check-button" onClick={handleCheck}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Check Completeness
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
