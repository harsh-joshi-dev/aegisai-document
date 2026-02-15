import type { RiskSignal } from '../services/risk/types';

const severityStyles: Record<RiskSignal['severity'], string> = {
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.3)]',
};

const impactStyles: Record<RiskSignal['impact'], string> = {
  financial: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  compliance: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  fraud: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const actionStyles: Record<RiskSignal['suggestedAction'], string> = {
  approve: 'bg-green-500/10 text-green-400',
  hold: 'bg-yellow-500/10 text-yellow-400',
  reject: 'bg-red-500/10 text-red-400',
  verify: 'bg-blue-500/10 text-blue-400',
};

export function RiskSignalCard({ signal }: { signal: RiskSignal }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">{signal.title || signal.explanation}</h4>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityStyles[signal.severity]}`}>
            {signal.severity}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${actionStyles[signal.suggestedAction]}`}>
            {signal.suggestedAction}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-zinc-400 leading-relaxed mb-3">{signal.explanation}</p>
      
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-zinc-500">Impact:</span>
        <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-medium capitalize ${impactStyles[signal.impact]}`}>
          {signal.impact}
        </span>
        <span className="text-xs text-zinc-500">•</span>
        <span className="text-xs text-zinc-500">Confidence: {signal.confidence}%</span>
        <span className="text-xs text-zinc-500">•</span>
        <span className="text-xs text-zinc-500">Weight: {signal.weight}</span>
      </div>

      {signal.evidence.length > 0 && (
        <div className="mb-3 rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs font-semibold text-zinc-300 mb-2">Evidence:</p>
          <ul className="space-y-1">
            {signal.evidence.map((evidence, index) => (
              <li key={index} className="text-xs text-zinc-400 flex items-start gap-2">
                <span className="text-zinc-500 mt-0.5">•</span>
                <span>{evidence}</span>
              </li>
            ))}
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
        <div className="mt-2 text-xs text-emerald-300">
          {typeof signal.recommendation === 'object' && (
            <>
              Action: {signal.recommendation.action} (Priority: {signal.recommendation.priority})
            </>
          )}
        </div>
      </div>

      {signal.metadata.documentIds.length > 0 && (
        <div className="mt-2 text-xs text-zinc-500">
          Related documents: {signal.metadata.documentIds.length}
        </div>
      )}
    </div>
  );
}
