import type { RiskSignal } from '../services/risk/types';
import { FolderPlus, Users, TrendingUp } from 'lucide-react';

interface VendorFolderRecommendationsProps {
  signals: RiskSignal[];
  onCreateFolder?: (vendorName: string, documentIds: string[]) => void;
}

export function VendorFolderRecommendations({ signals, onCreateFolder }: VendorFolderRecommendationsProps) {
  // Filter for vendor folder signals
  const vendorSignals = signals.filter(s => s.subtype === 'vendor_folder_needed');
  
  if (vendorSignals.length === 0) {
    return null;
  }

  // Group by vendor to avoid duplicates
  const vendorGroups = vendorSignals.reduce((acc, signal) => {
    const vendor = signal.evidence.find(e => e.startsWith('Vendor: '))?.replace('Vendor: ', '');
    if (vendor && !acc[vendor]) {
      acc[vendor] = {
        signal,
        documentCount: signal.metadata.documentIds.length,
        totalAmount: signal.evidence.find(e => e.startsWith('Total amount: '))?.replace('Total amount: ', '') || '₹0'
      };
    }
    return acc;
  }, {} as Record<string, { signal: RiskSignal; documentCount: number; totalAmount: string }>);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
      <div className="flex items-center gap-2 mb-4">
        <FolderPlus className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Vendor Folder Organization</h3>
        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
          {Object.keys(vendorGroups).length} vendor{Object.keys(vendorGroups).length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(vendorGroups).map(([vendor, { signal, documentCount, totalAmount }]) => (
          <div key={vendor} className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  {vendor}
                </h4>
                <p className="text-sm text-zinc-400 mt-1">
                  {signal.explanation}
                </p>
              </div>
              <button
                onClick={() => onCreateFolder?.(vendor, signal.metadata.documentIds)}
                className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Create Folder
              </button>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {documentCount} documents
              </span>
              <span>{totalAmount}</span>
              <span>Priority: {typeof signal.recommendation === 'object' ? signal.recommendation.priority : 'N/A'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-blue-500/10">
        <p className="text-xs text-zinc-400">
          Organizing documents by vendor folders improves document management, searchability, and audit trails.
        </p>
      </div>
    </div>
  );
}
