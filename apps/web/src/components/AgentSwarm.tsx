import { useState, useEffect } from 'react';
import { executeAgentSwarm, AgentSwarmResponse } from '../api/client';
import './AgentSwarm.css';

interface AgentSwarmProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

interface AgentStatus {
  name: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description: string;
}

export default function AgentSwarm({ isOpen, onClose, documentId, documentName }: AgentSwarmProps) {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AgentSwarmResponse['result'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userParty, setUserParty] = useState('');
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);

  useEffect(() => {
    if (isOpen && !result && !executing) {
      // Initialize agent statuses
      setAgentStatuses([
        { name: 'Extractor', icon: '🔍', status: 'pending', description: 'Extracting terms, dates, obligations' },
        { name: 'Risk Analyst', icon: '⚠️', status: 'pending', description: 'Analyzing risks and predicting issues' },
        { name: 'Compliance', icon: '📋', status: 'pending', description: 'Checking 50+ jurisdictions' },
        { name: 'Negotiation', icon: '🤝', status: 'pending', description: 'Drafting counter-proposals' },
        { name: 'Action', icon: '⚡', status: 'pending', description: 'Generating action plan' },
      ]);
    }
  }, [isOpen, result, executing]);

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    setResult(null);

    // Simulate agent execution with status updates
    const agents = [
      { name: 'Extractor', icon: '🔍' },
      { name: 'Risk Analyst', icon: '⚠️' },
      { name: 'Compliance', icon: '📋' },
      { name: 'Negotiation', icon: '🤝' },
      { name: 'Action', icon: '⚡' },
    ];

    // Update statuses to running
    agents.forEach((_, index) => {
      setTimeout(() => {
        setAgentStatuses(prev => prev.map((a, i) =>
          i === index ? { ...a, status: 'running' as const } : a
        ));
      }, index * 500);
    });

    try {
      const response = await executeAgentSwarm({
        documentId,
        userParty: userParty || undefined,
      });

      setResult(response.result);

      // Update agent statuses based on result
      setAgentStatuses([
        {
          name: 'Extractor',
          icon: '🔍',
          status: response.result.agents.extractor.status === 'completed' ? 'completed' : 'failed',
          description: response.result.agents.extractor.status === 'completed'
            ? `Extracted ${response.result.agents.extractor.data?.terms.length || 0} terms, ${response.result.agents.extractor.data?.dates.length || 0} dates`
            : response.result.agents.extractor.error || 'Failed',
        },
        {
          name: 'Risk Analyst',
          icon: '⚠️',
          status: response.result.agents.riskAnalyst.status === 'completed' ? 'completed' : 'failed',
          description: response.result.agents.riskAnalyst.status === 'completed'
            ? `Risk Score: ${response.result.agents.riskAnalyst.analysis?.riskScore || 0}/100`
            : response.result.agents.riskAnalyst.error || 'Failed',
        },
        {
          name: 'Compliance',
          icon: '📋',
          status: response.result.agents.compliance.status === 'completed' ? 'completed' : 'failed',
          description: response.result.agents.compliance.status === 'completed'
            ? `${response.result.agents.compliance.analysis?.checks.length || 0} jurisdictions checked`
            : response.result.agents.compliance.error || 'Failed',
        },
        {
          name: 'Negotiation',
          icon: '🤝',
          status: response.result.agents.negotiation.status === 'completed' ? 'completed' : 'failed',
          description: response.result.agents.negotiation.status === 'completed'
            ? `${response.result.agents.negotiation.strategy?.counterProposals.length || 0} counter-proposals`
            : response.result.agents.negotiation.error || 'Failed',
        },
        {
          name: 'Action',
          icon: '⚡',
          status: response.result.agents.action.status === 'completed' ? 'completed' : 'failed',
          description: response.result.agents.action.status === 'completed'
            ? `${response.result.agents.action.plan?.actions.length || 0} actions generated`
            : response.result.agents.action.error || 'Failed',
        },
      ]);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to execute agent swarm');
      setAgentStatuses(prev => prev.map(a => ({ ...a, status: 'failed' as const })));
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="agent-swarm-overlay" onClick={onClose}>
      <div className="agent-swarm-container" onClick={(e) => e.stopPropagation()}>
        <div className="agent-swarm-header">
          <div>
            <h2>🤖 Autonomous Agent Swarm</h2>
            <p className="subtitle">Multi-agent collaboration for end-to-end document workflows</p>
          </div>
          <button className="agent-swarm-close" onClick={onClose}>×</button>
        </div>

        <div className="agent-swarm-content">
          <div className="document-info">
            <p>📄 <strong>{documentName}</strong></p>
          </div>

          {!result && !executing && (
            <div className="agent-swarm-setup">
              <div className="setup-field">
                <label htmlFor="user-party">Your Party (Optional):</label>
                <input
                  id="user-party"
                  type="text"
                  placeholder="e.g., Buyer, Seller, Company Name"
                  value={userParty}
                  onChange={(e) => setUserParty(e.target.value)}
                  className="party-input"
                />
              </div>
              <button
                className="execute-button"
                onClick={handleExecute}
                disabled={executing}
              >
                🚀 Deploy Agent Swarm
              </button>
            </div>
          )}

          {(executing || result) && (
            <div className="agent-workflow">
              <h3>Agent Workflow</h3>
              <div className="agents-list">
                {agentStatuses.map((agent, index) => (
                  <div key={index} className={`agent-card ${agent.status}`}>
                    <div className="agent-icon">{agent.icon}</div>
                    <div className="agent-info">
                      <div className="agent-name">{agent.name} Agent</div>
                      <div className="agent-description">{agent.description}</div>
                    </div>
                    <div className="agent-status-badge">
                      {agent.status === 'pending' && '⏳ Pending'}
                      {agent.status === 'running' && '🔄 Running...'}
                      {agent.status === 'completed' && '✅ Completed'}
                      {agent.status === 'failed' && '❌ Failed'}
                    </div>
                  </div>
                ))}
              </div>

              {executing && (
                <div className="execution-info">
                  <div className="loading-spinner"></div>
                  <p>Agents are collaborating on your document...</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="agent-swarm-error">
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div className="agent-results">
              <div className="results-summary">
                <h3>📊 Results Summary</h3>
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-label">Status:</span>
                    <span className={`stat-value status-${result.status}`}>{result.status}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Execution Time:</span>
                    <span className="stat-value">{(result.executionTime / 1000).toFixed(2)}s</span>
                  </div>
                </div>
              </div>

              {/* Extractor Results */}
              {result.agents.extractor.status === 'completed' && result.agents.extractor.data && (
                <div className="agent-result-section">
                  <h4>🔍 Extractor Agent Results</h4>
                  <div className="extracted-data">
                    <div className="data-item">
                      <strong>Terms:</strong> {result.agents.extractor.data.terms.length}
                    </div>
                    <div className="data-item">
                      <strong>Dates:</strong> {result.agents.extractor.data.dates.length}
                    </div>
                    <div className="data-item">
                      <strong>Obligations:</strong> {result.agents.extractor.data.obligations.length}
                    </div>
                    <div className="data-item">
                      <strong>Parties:</strong> {result.agents.extractor.data.parties.join(', ')}
                    </div>
                    <div className="data-item">
                      <strong>Amounts:</strong> {result.agents.extractor.data.amounts.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Analyst Results */}
              {result.agents.riskAnalyst.status === 'completed' && result.agents.riskAnalyst.analysis && (
                <div className="agent-result-section">
                  <h4>⚠️ Risk Analyst Agent Results</h4>
                  <div className="risk-analysis">
                    <div className="risk-score-display">
                      <span className="score-label">Risk Score:</span>
                      <span className="score-value">{result.agents.riskAnalyst.analysis.riskScore}/100</span>
                    </div>
                    <div className="risk-details">
                      <div className="detail-item">
                        <strong>Current Risks:</strong> {result.agents.riskAnalyst.analysis.currentRisks.length}
                      </div>
                      <div className="detail-item">
                        <strong>Predicted Risks:</strong> {result.agents.riskAnalyst.analysis.predictedRisks.length}
                      </div>
                    </div>
                    {result.agents.riskAnalyst.analysis.recommendations.length > 0 && (
                      <div className="recommendations">
                        <strong>Recommendations:</strong>
                        <ul>
                          {result.agents.riskAnalyst.analysis.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Compliance Results */}
              {result.agents.compliance.status === 'completed' && result.agents.compliance.analysis && (
                <div className="agent-result-section">
                  <h4>📋 Compliance Agent Results</h4>
                  <div className="compliance-analysis">
                    <div className="compliance-score">
                      <span className="score-label">Compliance Score:</span>
                      <span className="score-value">{result.agents.compliance.analysis.overallComplianceScore}/100</span>
                    </div>
                    <div className="jurisdictions-checked">
                      <strong>Jurisdictions Checked:</strong> {result.agents.compliance.analysis.checks.length}
                    </div>
                    {result.agents.compliance.analysis.criticalIssues.length > 0 && (
                      <div className="critical-issues">
                        <strong>Critical Issues:</strong>
                        <ul>
                          {result.agents.compliance.analysis.criticalIssues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Negotiation Results */}
              {result.agents.negotiation.status === 'completed' && result.agents.negotiation.strategy && (
                <div className="agent-result-section">
                  <h4>🤝 Negotiation Agent Results</h4>
                  <div className="negotiation-strategy">
                    <div className="strategy-summary">
                      <p><strong>Strategy:</strong> {result.agents.negotiation.strategy.overallStrategy}</p>
                    </div>
                    <div className="counter-proposals">
                      <strong>Counter-Proposals:</strong> {result.agents.negotiation.strategy.counterProposals.length}
                      {result.agents.negotiation.strategy.counterProposals.slice(0, 3).map((proposal: any, idx: number) => (
                        <div key={idx} className="proposal-item">
                          <div className="proposal-header">
                            <span className="proposal-section">{proposal.section}</span>
                            <span className={`proposal-priority priority-${proposal.priority.toLowerCase()}`}>
                              {proposal.priority}
                            </span>
                          </div>
                          <div className="proposal-reason">{proposal.reason}</div>
                        </div>
                      ))}
                    </div>
                    {result.agents.negotiation.strategy.redLines.length > 0 && (
                      <div className="red-lines">
                        <strong>Red Lines (Non-Negotiable):</strong>
                        <ul>
                          {result.agents.negotiation.strategy.redLines.map((line: string, idx: number) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Plan */}
              {result.agents.action.status === 'completed' && result.agents.action.plan && (
                <div className="agent-result-section">
                  <h4>⚡ Action Agent Results</h4>
                  <div className="action-plan">
                    <div className="plan-summary">
                      <p>{result.agents.action.plan.summary}</p>
                    </div>
                    <div className="actions-breakdown">
                      <div className="breakdown-item">
                        <strong>Total Actions:</strong> {result.agents.action.plan.actions.length}
                      </div>
                      <div className="breakdown-item">
                        <strong>Auto-Executable:</strong> {result.agents.action.plan.autoExecutable.length}
                      </div>
                      <div className="breakdown-item">
                        <strong>Requires Approval:</strong> {result.agents.action.plan.requiresApproval.length}
                      </div>
                    </div>
                    <div className="actions-list">
                      <h5>Action Items:</h5>
                      {result.agents.action.plan.actions.slice(0, 10).map((action: any, idx: number) => (
                        <div key={idx} className="action-item">
                          <div className="action-header">
                            <span className="action-type">{action.type}</span>
                            <span className={`action-priority priority-${action.priority.toLowerCase()}`}>
                              {action.priority}
                            </span>
                          </div>
                          <div className="action-title">{action.title}</div>
                          <div className="action-description">{action.description}</div>
                          {action.dueDate && (
                            <div className="action-due">Due: {action.dueDate}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
