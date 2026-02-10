import { useState, useEffect } from 'react';
import {
  getWhatShouldIDoNext,
  type ActionIntelligenceResult,
  type Document,
} from '../api/client';
import './WhatShouldIDoNextModal.css';

interface WhatShouldIDoNextModalProps {
  document: Document;
  onClose: () => void;
}

const WHO_LABELS: Record<string, string> = {
  CA: 'Chartered Accountant',
  Lawyer: 'Tax / Legal Lawyer',
  User: 'You',
  Compliance: 'Compliance Team',
  Financial: 'Financial Advisor',
};

export default function WhatShouldIDoNextModal({ document, onClose }: WhatShouldIDoNextModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionIntelligenceResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getWhatShouldIDoNext(document.id);
        if (!cancelled) {
          setResult(res.result);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.response?.data?.message || e.message || 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [document.id]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content what-should-i-do-next-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>What Should I Do Next?</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="modal-body">
            <p className="loading-message">Analyzing document and preparing action plan…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content what-should-i-do-next-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>What Should I Do Next?</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="modal-body">
            <p className="error-message">{error || 'No result'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content what-should-i-do-next-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>What Should I Do Next?</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">
          <div className="action-intel-summary">
            <p className="summary-statement">{result.summaryStatement}</p>
          </div>
          {result.immediateRisks.length > 0 && (
            <section className="action-intel-section">
              <h3>Immediate risks</h3>
              <ul className="immediate-risks">
                {result.immediateRisks.map((r, i) => (
                  <li key={i} className={`risk-severity-${r.severity.toLowerCase()}`}>
                    {r.severity === 'Critical' ? '✅' : '⚠️'} {r.description}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="action-intel-section">
            <h3>Action required</h3>
            <p className="action-required">{result.actionRequired}</p>
          </section>
          {(result.deadline || result.urgency !== 'None') && (
            <section className="action-intel-section">
              <h3>Deadline / Urgency</h3>
              <p>
                {result.deadline && <span className="deadline">⏰ {result.deadline}</span>}
                {result.deadline && result.urgency !== 'None' && ' · '}
                {result.urgency !== 'None' && <span className="urgency">Urgency: {result.urgency}</span>}
              </p>
            </section>
          )}
          <section className="action-intel-section">
            <h3>Who should handle this</h3>
            <p className="who-handle">👤 {WHO_LABELS[result.whoShouldHandle] || result.whoShouldHandle}</p>
          </section>
          <section className="action-intel-section suggested-next">
            <h3>Suggested next step</h3>
            <p className="suggested-next-step">💡 {result.suggestedNextStep}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
