import { useState } from 'react';
import { analyzeWhatIf, WhatIfResponse } from '../api/client';
import { Sparkles, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

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



  const getCategoryIcon = (category: string) => {
    // Return simple emojis or lucide icons could be better, but sticking to logic
    switch (category) {
      case 'Legal': return '⚖️';
      case 'Financial': return '💰';
      case 'Compliance': return '📋';
      case 'Operational': return '⚙️';
      case 'Reputational': return '⭐';
      default: return '📌';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#141416] border border-subtle shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle bg-subtle backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">What If Simulator</h2>
              <p className="text-xs text-muted">Simulate outcomes for <span className="text-main">{documentName}</span></p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted py-1">Try asking:</span>
              <button
                type="button"
                className="text-xs bg-subtle hover:bg-card-hover text-main px-3 py-1 rounded-full border border-subtle transition"
                onClick={() => setScenario('What happens if I ignore this notice? Show penalty growth and legal risks.')}
              >
                "Ignore this notice"
              </button>
              <button
                type="button"
                className="text-xs bg-subtle hover:bg-card-hover text-main px-3 py-1 rounded-full border border-subtle transition"
                onClick={() => setScenario('What if I delay payment by 15 days? Show interest calculation.')}
              >
                "Delay payment 15 days"
              </button>
            </div>

            <div className="relative">
              <textarea
                className="ds-input w-full min-h-[100px] bg-subtle border-subtle focus:border-blue-500 text-base resize-y p-4"
                placeholder='Enter your scenario here... e.g., "What if I terminate the contract early?"'
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              />
              <div className="absolute bottom-3 right-3">
                <button
                  className="btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  onClick={handleAnalyze}
                  disabled={loading || !scenario.trim()}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Simulate Scenario
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="animate-slide-up space-y-6">

              {/* Score Card */}
              <div className="p-5 rounded-xl bg-subtle border border-subtle flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted uppercase tracking-wider">Projected Risk Score</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-main">{result.riskScore}</span>
                    <span className="text-sm text-dim">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${result.overallSeverity === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-900/50' :
                    result.overallSeverity === 'High' ? 'bg-orange-500/10 text-orange-500 border-orange-900/50' :
                      result.overallSeverity === 'Medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-900/50' :
                        'bg-green-500/10 text-green-500 border-green-900/50'
                    }`}>
                    {result.overallSeverity} Risk
                  </span>
                </div>
              </div>

              {/* Risk Meter */}
              <div className="h-2 w-full bg-subtle rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-1000 ease-out rounded-full"
                  style={{
                    width: `${result.riskScore}%`,
                    background: `linear-gradient(90deg, ${result.overallSeverity === 'Critical' ? '#ef4444' :
                      result.overallSeverity === 'High' ? '#f97316' :
                        '#eab308'
                      }, transparent)`
                  }}
                />
              </div>

              {/* Consequences Grid */}
              <div>
                <h4 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  Potential Consequences
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {result.consequences.map((consequence, index) => (
                    <div key={index} className="p-4 rounded-xl bg-subtle border border-subtle hover:border-light transition group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getCategoryIcon(consequence.category)}</span>
                          <span className="font-medium text-main">{consequence.category}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded border ${consequence.severity === 'High' ? 'text-red-400 border-red-900/30' : 'text-dim border-zinc-800'
                          }`}>
                          {consequence.likelihood}
                        </span>
                      </div>
                      <p className="text-sm text-muted mb-3 leading-relaxed">{consequence.description}</p>
                      <div className="text-xs p-2 bg-subtle rounded border border-subtle text-main">
                        <span className="text-dim font-medium">Impact:</span> {consequence.impact}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <h4 className="text-base font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    <Info size={18} />
                    Recommended Actions
                  </h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-main">
                        <CheckCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
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
