import { useState } from 'react';
import { analyzeWhatIf, WhatIfResponse } from '../api/client';
import './WhatIfSimulator.css';

interface WhatIfSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export default function WhatIfSimulator({ isOpen, onClose, documentId, documentName }: WhatIfSimulatorProps) {
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResponse['analysis'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!scenario.trim()) {
      setError('Please enter a scenario to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await analyzeWhatIf({
        documentId,
        scenario: scenario.trim(),
        language: 'en',
      });
      setResult(response.analysis);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to analyze scenario');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return '#dc2626';
      case 'High':
        return '#ea580c';
      case 'Medium':
        return '#ca8a04';
      case 'Low':
        return '#16a34a';
      default:
        return '#6b7280';
    }
  };

  const getLikelihoodColor = (likelihood: string) => {
    switch (likelihood) {
      case 'Very Likely':
        return '#dc2626';
      case 'Likely':
        return '#ea580c';
      case 'Possible':
        return '#ca8a04';
      case 'Unlikely':
        return '#16a34a';
      default:
        return '#6b7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Legal':
        return '⚖️';
      case 'Financial':
        return '💰';
      case 'Compliance':
        return '📋';
      case 'Operational':
        return '⚙️';
      case 'Reputational':
        return '⭐';
      default:
        return '📌';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="what-if-overlay" onClick={onClose}>
      <div className="what-if-container" onClick={(e) => e.stopPropagation()}>
        <div className="what-if-header">
          <h2>🤔 What If Simulator</h2>
          <button className="what-if-close" onClick={onClose}>×</button>
        </div>

        <div className="what-if-content">
          <div className="what-if-info">
            <p>Simulate consequences before acting. Ask "what if" questions about this document.</p>
            <p className="document-name">📄 {documentName}</p>
          </div>

          <div className="what-if-input-section">
            <label htmlFor="scenario-input">Enter your scenario:</label>
            <textarea
              id="scenario-input"
              className="scenario-input"
              placeholder='e.g., "What happens if I ignore this notice?" or "What if I delay payment by 15 days?"'
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={3}
            />
            <button
              className="analyze-button"
              onClick={handleAnalyze}
              disabled={loading || !scenario.trim()}
            >
              {loading ? '⏳ Analyzing...' : '🔍 Analyze Scenario'}
            </button>
          </div>

          {error && (
            <div className="what-if-error">
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div className="what-if-results">
              <div className="results-header">
                <h3>Analysis Results</h3>
                <div className="overall-severity">
                  <span className="severity-label">Overall Severity:</span>
                  <span
                    className="severity-badge"
                    style={{ backgroundColor: getSeverityColor(result.overallSeverity) }}
                  >
                    {result.overallSeverity}
                  </span>
                  <span className="risk-score">Risk Score: {result.riskScore}/100</span>
                </div>
              </div>

              <div className="severity-meter">
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${result.riskScore}%`,
                      backgroundColor: getSeverityColor(result.overallSeverity),
                    }}
                  />
                </div>
                <div className="meter-labels">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>

              <div className="consequences-list">
                <h4>Consequences:</h4>
                {result.consequences.map((consequence, index) => (
                  <div key={index} className="consequence-card">
                    <div className="consequence-header">
                      <span className="category-icon">{getCategoryIcon(consequence.category)}</span>
                      <span className="consequence-category">{consequence.category}</span>
                      <span
                        className="severity-tag"
                        style={{ backgroundColor: getSeverityColor(consequence.severity) }}
                      >
                        {consequence.severity}
                      </span>
                      <span
                        className="likelihood-tag"
                        style={{ backgroundColor: getLikelihoodColor(consequence.likelihood) }}
                      >
                        {consequence.likelihood}
                      </span>
                    </div>
                    <div className="consequence-description">{consequence.description}</div>
                    <div className="consequence-impact">
                      <strong>Impact:</strong> {consequence.impact}
                    </div>
                  </div>
                ))}
              </div>

              {result.recommendations.length > 0 && (
                <div className="recommendations">
                  <h4>💡 Recommendations:</h4>
                  <ul>
                    {result.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
