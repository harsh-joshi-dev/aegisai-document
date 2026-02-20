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
 * Detect vendor frequency spikes with seasonal baseline modeling.
 * Compares current month against both:
 *   - Same month from previous years (seasonal baseline)
 *   - Rolling 12-month average
 * This prevents false positives for predictable seasonal patterns
 * (e.g. December invoice surges, March year-end filings).
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
  
  const vendorDocs = await getDocumentsForPatternDetection(tenantId, {
    vendorKey,
    limit: 200,
  });
  
  if (vendorDocs.length < 5) {
    return signals;
  }
  
  const monthlyCounts = new Map<string, number>();
  
  for (const doc of vendorDocs) {
    const date = new Date(doc.uploaded_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
  }
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const currentCount = monthlyCounts.get(currentMonthKey) || 0;

  // Build seasonal baseline: same calendar month in prior years
  const sameMonthCounts: number[] = [];
  for (let y = currentYear - 3; y < currentYear; y++) {
    const key = `${y}-${String(currentMonth + 1).padStart(2, '0')}`;
    const c = monthlyCounts.get(key);
    if (c !== undefined) sameMonthCounts.push(c);
  }

  // Rolling 12-month average (excluding current month)
  const rollingCounts: number[] = [];
  for (let offset = 1; offset <= 12; offset++) {
    const d = new Date(currentYear, currentMonth - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const c = monthlyCounts.get(key);
    if (c !== undefined) rollingCounts.push(c);
  }

  const seasonalAvg = sameMonthCounts.length > 0
    ? sameMonthCounts.reduce((a, b) => a + b, 0) / sameMonthCounts.length
    : null;
  const rollingAvg = rollingCounts.length >= 3
    ? rollingCounts.reduce((a, b) => a + b, 0) / rollingCounts.length
    : null;

  // Use seasonal baseline when available, falling back to rolling average
  const baseline = seasonalAvg !== null ? seasonalAvg : rollingAvg;

  if (baseline !== null && baseline > 0 && currentCount > baseline * 2.5) {
    const increasePct = ((currentCount - baseline) / baseline * 100).toFixed(0);
    const baselineType = seasonalAvg !== null ? 'seasonal' : 'rolling';
    
    const recommendation: Recommendation = {
      action_type: 'review',
      message: `Vendor ${vendorKey} transaction volume increased ${increasePct}% vs ${baselineType} baseline - verify legitimacy`,
      priority: 'medium',
    };
    
    signals.push({
      tenant_id: tenantId,
      document_id: documentId,
      type: 'pattern',
      subtype: 'vendor_frequency_spike',
      severity: 'medium',
      confidence: seasonalAvg !== null ? 0.85 : 0.7,
      weight: 1.5,
      explanation: `Vendor ${vendorKey} has ${currentCount} transactions this month vs ${baselineType} baseline of ${baseline.toFixed(1)} (${increasePct}% increase)`,
      recommendation,
      metadata: {
        vendor_key: vendorKey,
        current_month_count: currentCount,
        baseline_value: parseFloat(baseline.toFixed(1)),
        baseline_type: baselineType,
        seasonal_history: sameMonthCounts,
        rolling_history: rollingCounts,
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

/**
 * Detect circular payment chains across documents.
 * Builds a payment graph from vendor→customer GSTIN pairs and
 * finds cycles (A pays B, B pays C, C pays A).
 */
export async function detectCircularPayments(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): Promise<RiskSignalInput[]> {
  const signals: RiskSignalInput[] = [];
  const vendorGstin = extractedData.vendorGstin || extractedData.vendor_gstin;
  const customerGstin = extractedData.customerGstin || extractedData.customer_gstin;

  if (!vendorGstin || !customerGstin || vendorGstin === customerGstin) {
    return signals;
  }

  const recentDocs = await getDocumentsForPatternDetection(tenantId, { limit: 500 });

  // Build a directed graph: payer (customerGstin) → payee (vendorGstin)
  const edges = new Map<string, Set<string>>();
  const edgeDocMap = new Map<string, string[]>(); // "from→to" → document ids

  for (const doc of recentDocs) {
    const vg = doc.extracted_data?.vendorGstin || doc.extracted_data?.vendor_gstin;
    const cg = doc.extracted_data?.customerGstin || doc.extracted_data?.customer_gstin;
    if (!vg || !cg || vg === cg) continue;

    if (!edges.has(cg)) edges.set(cg, new Set());
    edges.get(cg)!.add(vg);

    const edgeKey = `${cg}→${vg}`;
    if (!edgeDocMap.has(edgeKey)) edgeDocMap.set(edgeKey, []);
    edgeDocMap.get(edgeKey)!.push(doc.id);
  }

  // Include the current document's edge
  if (!edges.has(customerGstin)) edges.set(customerGstin, new Set());
  edges.get(customerGstin)!.add(vendorGstin);
  const currentEdgeKey = `${customerGstin}→${vendorGstin}`;
  if (!edgeDocMap.has(currentEdgeKey)) edgeDocMap.set(currentEdgeKey, []);
  edgeDocMap.get(currentEdgeKey)!.push(documentId);

  // DFS from vendorGstin to see if we can reach back to customerGstin (cycle)
  const visited = new Set<string>();
  const cyclePath: string[] = [];

  function dfs(node: string, target: string, path: string[]): boolean {
    if (path.length > 6) return false; // limit cycle length
    if (node === target && path.length >= 2) {
      cyclePath.push(...path, node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);

    const neighbors = edges.get(node);
    if (!neighbors) return false;

    for (const next of neighbors) {
      if (dfs(next, target, [...path, node])) return true;
    }
    return false;
  }

  const found = dfs(vendorGstin, customerGstin, []);

  if (found && cyclePath.length >= 3) {
    const cycleStr = cyclePath.join(' → ');
    const affectedDocIds = new Set<string>();
    for (let i = 0; i < cyclePath.length - 1; i++) {
      const ek = `${cyclePath[i]}→${cyclePath[i + 1]}`;
      (edgeDocMap.get(ek) || []).forEach(id => affectedDocIds.add(id));
    }

    const recommendation: Recommendation = {
      action_type: 'reject',
      message: `Circular payment chain detected: ${cycleStr}. This is a strong indicator of round-tripping or fund laundering. Investigate all parties immediately.`,
      priority: 'critical',
    };

    signals.push({
      tenant_id: tenantId,
      document_id: documentId,
      type: 'pattern',
      subtype: 'circular_payment',
      severity: 'critical',
      confidence: 0.9,
      weight: 3.0,
      explanation: `Circular payment chain detected involving ${cyclePath.length - 1} entities: ${cycleStr}. Money flows in a loop, which is a red flag for round-tripping or layered fund movement.`,
      recommendation,
      metadata: {
        cycle_path: cyclePath,
        cycle_length: cyclePath.length - 1,
        affected_document_ids: [...affectedDocIds],
        pattern_type: 'circular_payment',
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
    detectCircularPayments(tenant_id, document_id, extracted_data),
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
