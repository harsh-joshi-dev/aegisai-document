import type { RiskSignal } from '../services/risk/types';

const severityStyles: Record<RiskSignal['severity'], string> = {
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.3)]',
};

export function IssueCard({ issue }: { issue: RiskSignal | any }) {
  // Check if this is a new RiskSignal or legacy Issue
  const isRiskSignal = issue && typeof issue === 'object' && 'confidence' in issue && 'weight' in issue;
  
  if (isRiskSignal) {
    // Use new RiskSignal display
    const signal = issue as RiskSignal;
    const impactStyles = {
      financial: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      compliance: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      fraud: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-white">{signal.title || signal.explanation}</h4>
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityStyles[signal.severity]}`}>
            {signal.severity}
          </span>
        </div>
        
        <p className="text-sm text-zinc-400 leading-relaxed mb-3">{signal.explanation}</p>
        
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-zinc-500">Impact:</span>
          <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-medium capitalize ${impactStyles[signal.impact]}`}>
            {signal.impact}
          </span>
          <span className="text-xs text-zinc-500">•</span>
          <span className="text-xs text-zinc-500">Confidence: {signal.confidence}%</span>
        </div>

        {signal.evidence.length > 0 && (
          <div className="mb-3 rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-xs font-semibold text-zinc-300 mb-2">Evidence:</p>
            <ul className="space-y-1">
              {signal.evidence.slice(0, 3).map((evidence, index) => (
                <li key={index} className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">•</span>
                  <span>{evidence}</span>
                </li>
              ))}
              {signal.evidence.length > 3 && (
                <li className="text-xs text-zinc-500">+{signal.evidence.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
          <p className="text-xs text-emerald-400">
            <span className="font-bold">Recommendation:</span> 
            {typeof signal.recommendation === 'string' 
              ? signal.recommendation 
              : signal.recommendation.reason}
          </p>
          <div className="mt-1 text-xs text-emerald-300">
            {typeof signal.recommendation === 'object' && (
              <>
                Action: {signal.recommendation.action} (Priority: {signal.recommendation.priority})
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Legacy Issue display
  const legacySeverityStyles: Record<string, string> = {
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    High: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.3)]',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">{issue.title}</h4>
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${legacySeverityStyles[issue.severity]}`}>
          {issue.severity}
        </span>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{issue.explanation}</p>
      <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
        <p className="text-xs text-emerald-400">
          <span className="font-bold">Recommendation:</span> {issue.recommendation}
        </p>
      </div>
    </div>
  );
}
