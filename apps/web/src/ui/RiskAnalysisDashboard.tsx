import type { RiskSignal, RiskResult } from '../services/risk/types';
import { RiskSignalCard } from './RiskSignalCard';
import { RecommendationsPanel } from './RecommendationsPanel';
import { RiskScorePanel } from './RiskScorePanel';
import { VendorFolderRecommendations } from './VendorFolderRecommendations';

interface RiskAnalysisDashboardProps {
  riskResult?: RiskResult;
  signals: RiskSignal[];
  loading?: boolean;
  onCreateVendorFolder?: (vendorName: string, documentIds: string[]) => void;
}

export function RiskAnalysisDashboard({ riskResult, signals, loading, onCreateVendorFolder }: RiskAnalysisDashboardProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded w-1/4 mb-4"></div>
            <div className="h-2 bg-white/10 rounded w-full mb-2"></div>
            <div className="h-2 bg-white/10 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Score Panel */}
      <RiskScorePanel riskResult={riskResult} signals={signals} />
      
      {/* Vendor Folder Recommendations */}
      <VendorFolderRecommendations 
        signals={signals} 
        onCreateFolder={onCreateVendorFolder}
      />
      
      {/* Recommendations Panel */}
      <RecommendationsPanel signals={signals} />
      
      {/* Risk Signals */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Risk Issues</h3>
        
        {signals.length === 0 ? (
          <p className="text-sm text-zinc-400">No risk issues detected.</p>
        ) : (
          <div className="space-y-4">
            {signals.sort((a, b) => {
              // Sort by severity first, then by priority
              const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
              const aSeverity = severityOrder[a.severity];
              const bSeverity = severityOrder[b.severity];
              
              if (aSeverity !== bSeverity) {
                return aSeverity - bSeverity;
              }
              
              const aPriority = typeof a.recommendation === 'object' ? a.recommendation.priority : 999;
              const bPriority = typeof b.recommendation === 'object' ? b.recommendation.priority : 999;
              
              return aPriority - bPriority;
            }).map((signal) => (
              <RiskSignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
