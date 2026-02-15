import type { RiskSignal, RiskResult } from '../services/risk/types';

interface RiskScorePanelProps {
  riskResult?: RiskResult;
  signals: RiskSignal[];
}

const levelStyles: Record<string, { bg: string; text: string; border: string }> = {
  SAFE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  REVIEW: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  HIGH: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

function getScoreColor(score: number): string {
  if (score <= 25) return 'text-emerald-400';
  if (score <= 50) return 'text-amber-400';
  if (score <= 75) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBackground(score: number): string {
  if (score <= 25) return 'bg-emerald-500/20';
  if (score <= 50) return 'bg-amber-500/20';
  if (score <= 75) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

export function RiskScorePanel({ riskResult, signals }: RiskScorePanelProps) {
  const score = riskResult?.score || calculateScoreFromSignals(signals);
  const level = riskResult?.level || getLevelFromScore(score);
  
  // Break down by issue types
  const typeBreakdown = signals.reduce((acc, signal) => {
    if (!acc[signal.type]) {
      acc[signal.type] = { count: 0, totalWeight: 0, severityBreakdown: {} as Record<string, number> };
    }
    acc[signal.type].count++;
    acc[signal.type].totalWeight += signal.weight;
    
    if (!acc[signal.type].severityBreakdown[signal.severity]) {
      acc[signal.type].severityBreakdown[signal.severity] = 0;
    }
    acc[signal.type].severityBreakdown[signal.severity]++;
    
    return acc;
  }, {} as Record<string, { count: number; totalWeight: number; severityBreakdown: Record<string, number> }>);

  const levelStyle = levelStyles[level] || levelStyles.SAFE;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Risk Score</h3>
      
      {/* Overall Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Overall Risk Level</span>
          <span className={`text-sm font-bold ${levelStyle.text}`}>{level}</span>
        </div>
        
        <div className="flex items-center gap-4 mb-3">
          <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
            {score}
          </div>
          <div className="flex-1">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${getScoreBackground(score)}`}
                style={{ width: `${Math.min(score, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Type Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-zinc-300">Breakdown by Issue Type</h4>
        
        {Object.entries(typeBreakdown).length > 0 ? (
          Object.entries(typeBreakdown).map(([type, data]) => (
            <div key={type} className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium capitalize">{type}</span>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>{data.count} issue{data.count !== 1 ? 's' : ''}</span>
                  <span>Weight: {data.totalWeight}</span>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {Object.entries(data.severityBreakdown).map(([severity, count]) => (
                  <span 
                    key={severity}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      severity === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      severity === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {severity} ({count})
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400">No issues detected</p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-zinc-400">Total Signals:</span>
            <span className="ml-2 text-white font-medium">{signals.length}</span>
          </div>
          <div>
            <span className="text-zinc-400">Avg Confidence:</span>
            <span className="ml-2 text-white font-medium">
              {signals.length > 0 ? Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length) : 0}%
            </span>
          </div>
          <div>
            <span className="text-zinc-400">High Severity:</span>
            <span className="ml-2 text-orange-400 font-medium">
              {signals.filter(s => s.severity === 'HIGH' || s.severity === 'CRITICAL').length}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">Critical Issues:</span>
            <span className="ml-2 text-red-400 font-medium">
              {signals.filter(s => s.severity === 'CRITICAL').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateScoreFromSignals(signals: RiskSignal[]): number {
  if (signals.length === 0) return 0;
  
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const maxPossibleWeight = signals.length * 80; // CRITICAL weight
  
  return Math.min(Math.round((totalWeight / maxPossibleWeight) * 100), 100);
}

function getLevelFromScore(score: number): string {
  if (score <= 25) return 'SAFE';
  if (score <= 50) return 'REVIEW';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
}
