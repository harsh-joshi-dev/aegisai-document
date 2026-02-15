import type { RiskSignal } from '../services/risk/types';

interface RecommendationsPanelProps {
  signals: RiskSignal[];
}

const actionStyles: Record<RiskSignal['suggestedAction'], string> = {
  approve: 'bg-green-500/10 text-green-400 border-green-500/20',
  hold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  reject: 'bg-red-500/10 text-red-400 border-red-500/20',
  verify: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function RecommendationsPanel({ signals }: RecommendationsPanelProps) {
  // Group recommendations by action and sort by priority
  const groupedRecommendations = signals.reduce((acc, signal) => {
    const action = signal.suggestedAction;
    if (!acc[action]) {
      acc[action] = [];
    }
    acc[action].push(signal);
    return acc;
  }, {} as Record<RiskSignal['suggestedAction'], RiskSignal[]>);

  // Sort each group by priority (lower number = higher priority)
  Object.keys(groupedRecommendations).forEach(action => {
    groupedRecommendations[action as RiskSignal['suggestedAction']].sort((a, b) => {
      const aPriority = typeof a.recommendation === 'object' ? a.recommendation.priority : 999;
      const bPriority = typeof b.recommendation === 'object' ? b.recommendation.priority : 999;
      return aPriority - bPriority;
    });
  });

  // Sort actions by overall priority (highest priority signals first)
  const sortedActions = Object.keys(groupedRecommendations).sort((a, b) => {
    const aMinPriority = Math.min(...groupedRecommendations[a as RiskSignal['suggestedAction']].map(s => 
      typeof s.recommendation === 'object' ? s.recommendation.priority : 999
    ));
    const bMinPriority = Math.min(...groupedRecommendations[b as RiskSignal['suggestedAction']].map(s => 
      typeof s.recommendation === 'object' ? s.recommendation.priority : 999
    ));
    return aMinPriority - bMinPriority;
  });

  if (signals.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>
        <p className="text-sm text-zinc-400">No issues detected. Document appears to be clear for approval.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>
      
      <div className="space-y-4">
        {sortedActions.map(action => {
          const actionSignals = groupedRecommendations[action as RiskSignal['suggestedAction']];
          const highestPriority = Math.min(...actionSignals.map(s => 
          typeof s.recommendation === 'object' ? s.recommendation.priority : 999
        ));
          
          return (
            <div key={action} className={`rounded-lg border ${actionStyles[action as RiskSignal['suggestedAction']]} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold capitalize">{action}</h4>
                <span className="text-xs opacity-75">
                  Priority {highestPriority} • {actionSignals.length} issue{actionSignals.length > 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="space-y-2">
                {actionSignals.map(signal => (
                  <div key={signal.id} className="text-xs">
                    <p className="font-medium mb-1">{signal.title || signal.explanation}</p>
                    <p className="opacity-75">
                      {typeof signal.recommendation === 'string' 
                        ? signal.recommendation 
                        : signal.recommendation.reason}
                    </p>
                    {signal.metadata.documentIds.length > 0 && (
                      <p className="opacity-50 mt-1">
                        Affects {signal.metadata.documentIds.length} document{signal.metadata.documentIds.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Total issues: {signals.length}</span>
          <span>Highest priority: {Math.min(...signals.map(s => 
            typeof s.recommendation === 'object' ? s.recommendation.priority : 999
          ))}</span>
        </div>
      </div>
    </div>
  );
}
