/**
 * Pattern Detection V2
 * Cross-document pattern analysis emitting RiskSignals
 */

import type { RiskSignalInput, PatternDetectionInput, CrossDocumentPattern, Severity, Recommendation } from './types.js';
import { getDocumentsForPatternDetection } from './db.js';

// ============================================================================
// Pattern Detection Functions
// ============================================================================

/**
 * Detect repeated amounts across different vendors
 * Flags the same amount appearing with different vendors (potential duplicate/fraud)
 */
export async function detectRepeatedAmounts(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): Promise<RiskSignalInput[]> {
  const signals: RiskSignalInput[] = [];
  const amount = extractedData.totalAmount || extractedData.amount;
  
  if (!amount || isNaN(Number(amount))) {
    return signals;
  }
  
  const numericAmount = Number(amount);
  
  // Get recent documents from tenant
  const recentDocs = await getDocumentsForPatternDetection(tenantId, {
    limit: 100,
  });
  
  // Find documents with same amount but different vendors
  const sameAmountDifferentVendors = recentDocs.filter(doc => {
    if (doc.id === documentId) return false;
    
    const docAmount = doc.extracted_data?.totalAmount || doc.extracted_data?.amount;
    if (!docAmount || isNaN(Number(docAmount))) return false;
    
    const docVendor = doc.extracted_data?.vendorKey || doc.extracted_data?.vendor_gstin;
    const currentVendor = extractedData.vendorKey || extractedData.vendor_gstin;
    
    return Number(docAmount) === numericAmount && docVendor !== currentVendor;
  });
  
  if (sameAmountDifferentVendors.length >= 2) {
    const vendorKeys = [...new Set(sameAmountDifferentVendors.map(d => 
      d.extracted_data?.vendorKey || d.extracted_data?.vendor_gstin || 'unknown'
    ))];
    
    const recommendation: Recommendation = {
      action_type: 'verify',
      message: `Amount ${numericAmount} appears with ${vendorKeys.length} different vendors - verify no duplicate payments`,
      priority: 'high',
    };
    
    signals.push({
      tenant_id: tenantId,
      document_id: documentId,
      type: 'pattern',
      subtype: 'repeated_amount',
      severity: 'high',
      confidence: 0.85,
      weight: 2.0,
      explanation: `Amount ${numericAmount} appears in ${sameAmountDifferentVendors.length + 1} documents across different vendors (${vendorKeys.join(', ')})`,
      recommendation,
      metadata: {
        amount: numericAmount,
        affected_document_ids: sameAmountDifferentVendors.map(d => d.id),
        vendor_keys: vendorKeys,
        pattern_type: 'repeated_amounts',
      },
    });
  }
  
  return signals;
}

/**
 * Detect vendor frequency spikes
 * Flags unusual increase in transaction volume for a vendor
 */
export async function detectVendorFrequencySpike(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): Promise<RiskSignalInput[]> {
  const signals: RiskSignalInput[] = [];
  const vendorKey = extractedData.vendorKey || extractedData.vendor_gstin;
  
  if (!vendorKey) {
    return signals;
  }
  
  // Get documents for this vendor
  const vendorDocs = await getDocumentsForPatternDetection(tenantId, {
    vendorKey,
    limit: 50,
  });
  
  if (vendorDocs.length < 5) {
    return signals; // Not enough history
  }
  
  // Calculate monthly transaction counts
  const monthlyCounts = new Map<string, number>();
  
  for (const doc of vendorDocs) {
    const date = new Date(doc.uploaded_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
  }
  
  // Get current and previous month counts
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  
  const currentCount = monthlyCounts.get(currentMonthKey) || 0;
  const prevCount = monthlyCounts.get(prevMonthKey) || 0;
  
  // Check for spike (>200% increase)
  if (prevCount > 0 && currentCount > prevCount * 2) {
    const increasePct = ((currentCount - prevCount) / prevCount * 100).toFixed(0);
    
    const recommendation: Recommendation = {
      action_type: 'review',
      message: `Vendor ${vendorKey} transaction volume increased ${increasePct}% this month - verify legitimacy`,
      priority: 'medium',
    };
    
    signals.push({
      tenant_id: tenantId,
      document_id: documentId,
      type: 'pattern',
      subtype: 'vendor_frequency_spike',
      severity: 'medium',
      confidence: 0.75,
      weight: 1.5,
      explanation: `Vendor ${vendorKey} transactions increased from ${prevCount} to ${currentCount} (${increasePct}% increase)`,
      recommendation,
      metadata: {
        vendor_key: vendorKey,
        previous_month_count: prevCount,
        current_month_count: currentCount,
        increase_percentage: parseFloat(increasePct),
        pattern_type: 'vendor_frequency_spike',
      },
    });
  }
  
  return signals;
}

/**
 * Detect round number payments
 * Flags suspicious round numbers (potential manual/adjusted entries)
 */
export function detectRoundNumberPayments(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): RiskSignalInput[] {
  const signals: RiskSignalInput[] = [];
  const amount = extractedData.totalAmount || extractedData.amount;
  
  if (!amount || isNaN(Number(amount))) {
    return signals;
  }
  
  const numericAmount = Number(amount);
  
  // Check for suspicious round numbers
  const roundPatterns = [
    { divisor: 100000, severity: 'medium' as Severity, weight: 1.2 },
    { divisor: 50000, severity: 'low' as Severity, weight: 1.0 },
    { divisor: 10000, severity: 'low' as Severity, weight: 0.8 },
  ];
  
  for (const pattern of roundPatterns) {
    if (numericAmount % pattern.divisor === 0 && numericAmount >= pattern.divisor) {
      const recommendation: Recommendation = {
        action_type: 'verify',
        message: `Amount ${numericAmount} is a round number - verify accuracy`,
        priority: pattern.severity === 'medium' ? 'medium' : 'low',
      };
      
      signals.push({
        tenant_id: tenantId,
        document_id: documentId,
        type: 'pattern',
        subtype: 'round_number_payment',
        severity: pattern.severity,
        confidence: 0.7,
        weight: pattern.weight,
        explanation: `Amount ${numericAmount} is divisible by ${pattern.divisor.toLocaleString()}, suggesting a round number payment`,
        recommendation,
        metadata: {
          amount: numericAmount,
          divisor: pattern.divisor,
          pattern_type: 'round_number_payment',
        },
      });
      
      break; // Only flag the largest divisor match
    }
  }
  
  return signals;
}

/**
 * Detect rapid transactions
 * Flags multiple transactions from same vendor in short timeframe
 */
export async function detectRapidTransactions(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): Promise<RiskSignalInput[]> {
  const signals: RiskSignalInput[] = [];
  const vendorKey = extractedData.vendorKey || extractedData.vendor_gstin;
  
  if (!vendorKey) {
    return signals;
  }
  
  // Get documents for this vendor
  const vendorDocs = await getDocumentsForPatternDetection(tenantId, {
    vendorKey,
    limit: 20,
  });
  
  if (vendorDocs.length < 3) {
    return signals;
  }
  
  // Sort by upload date
  const sorted = vendorDocs.sort((a, b) => 
    new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
  
  // Check for rapid transactions (3+ within 7 days)
  const windowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  let rapidCount = 1;
  let earliestInWindow = new Date(sorted[0].uploaded_at);
  
  for (let i = 1; i < sorted.length; i++) {
    const date = new Date(sorted[i].uploaded_at);
    if (earliestInWindow.getTime() - date.getTime() <= windowMs) {
      rapidCount++;
    } else {
      break;
    }
  }
  
  if (rapidCount >= 3) {
    const recommendation: Recommendation = {
      action_type: 'review',
      message: `${rapidCount} transactions from vendor ${vendorKey} within 7 days - verify business necessity`,
      priority: 'medium',
    };
    
    signals.push({
      tenant_id: tenantId,
      document_id: documentId,
      type: 'pattern',
      subtype: 'rapid_transactions',
      severity: 'medium',
      confidence: 0.8,
      weight: 1.3,
      explanation: `${rapidCount} transactions from vendor ${vendorKey} detected within 7-day window`,
      recommendation,
      metadata: {
        vendor_key: vendorKey,
        transaction_count: rapidCount,
        window_days: 7,
        affected_document_ids: sorted.slice(0, rapidCount).map(d => d.id),
        pattern_type: 'rapid_transactions',
      },
    });
  }
  
  return signals;
}

// ============================================================================
// Main Pattern Detection Orchestrator
// ============================================================================

export async function detectPatterns(
  input: PatternDetectionInput
): Promise<RiskSignalInput[]> {
  const { tenant_id, document_id, extracted_data } = input;
  
  const allSignals: RiskSignalInput[] = [];
  
  // Run all pattern detectors
  const detectors = [
    detectRepeatedAmounts(tenant_id, document_id, extracted_data),
    detectVendorFrequencySpike(tenant_id, document_id, extracted_data),
    detectRapidTransactions(tenant_id, document_id, extracted_data),
  ];
  
  // Add synchronous detector
  allSignals.push(...detectRoundNumberPayments(tenant_id, document_id, extracted_data));
  
  // Wait for async detectors
  const asyncResults = await Promise.all(detectors);
  for (const signals of asyncResults) {
    allSignals.push(...signals);
  }
  
  return allSignals;
}
