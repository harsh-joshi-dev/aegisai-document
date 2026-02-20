/**
 * Risk Aggregation Engine
 * Calculates final risk scores from RiskSignals
 */

import type { 
  RiskSignal, 
  RiskResult, 
  Recommendation,
  Severity 
} from './types.js';
import { SEVERITY_WEIGHTS, RISK_LEVEL_BANDS } from './types.js';

// ============================================================================
// Risk Score Calculation
// ============================================================================

export function calculateRiskScore(signals: RiskSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }
  
  // Calculate weighted score
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  for (const signal of signals) {
    const severityWeight = SEVERITY_WEIGHTS[signal.severity];
    const weightedValue = severityWeight * signal.weight * signal.confidence;
    totalWeightedScore += weightedValue;
    totalWeight += signal.weight;
  }
  
  // Normalize to 0-100 scale
  // Max possible per signal: 4 (critical) * 3 (max weight) * 1.0 (confidence) = 12
  // We scale based on signal count to avoid punishing documents with few signals
  const maxScorePerSignal = 12;
  const theoreticalMax = Math.max(signals.length * maxScorePerSignal, 24);
  const normalizedScore = (totalWeightedScore / theoreticalMax) * 100;
  
  return Math.min(100, Math.max(0, Math.round(normalizedScore)));
}

export function determineRiskLevel(score: number): 'safe' | 'review' | 'high' | 'critical' {
  if (score <= RISK_LEVEL_BANDS.safe.max) {
    return 'safe';
  } else if (score <= RISK_LEVEL_BANDS.review.max) {
    return 'review';
  } else if (score <= RISK_LEVEL_BANDS.high.max) {
    return 'high';
  } else {
    return 'critical';
  }
}

// ============================================================================
// Recommendation Aggregation
// ============================================================================

export function aggregateRecommendations(signals: RiskSignal[]): Recommendation[] {
  // Extract all recommendations
  const allRecommendations = signals
    .filter(s => s.recommendation && s.recommendation.message)
    .map(s => ({
      ...s.recommendation,
      source_signal_type: s.type,
      source_severity: s.severity,
    }));
  
  // Deduplicate by message similarity (simple exact match for MVP)
  const seen = new Set<string>();
  const unique: typeof allRecommendations = [];
  
  for (const rec of allRecommendations) {
    const key = `${rec.action_type}:${rec.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rec);
    }
  }
  
  // Sort by priority (critical > high > medium > low)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  unique.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  // Return cleaned recommendations
  return unique.map(r => ({
    action_type: r.action_type,
    message: r.message,
    priority: r.priority,
  }));
}

// ============================================================================
// Summary Generation
// ============================================================================

export function generateSummary(
  score: number,
  level: string,
  signals: RiskSignal[]
): string {
  const counts = countBySeverity(signals);
  
  if (signals.length === 0) {
    return 'No risk signals detected. Document appears safe for processing.';
  }
  
  const parts: string[] = [];
  
  // Overall assessment
  parts.push(`Risk assessment: ${level.toUpperCase()} (score: ${score}/100).`);
  
  // Signal breakdown
  const breakdown: string[] = [];
  if (counts.critical > 0) breakdown.push(`${counts.critical} critical`);
  if (counts.high > 0) breakdown.push(`${counts.high} high`);
  if (counts.medium > 0) breakdown.push(`${counts.medium} medium`);
  if (counts.low > 0) breakdown.push(`${counts.low} low`);
  
  if (breakdown.length > 0) {
    parts.push(`Detected ${signals.length} risk signals (${breakdown.join(', ')}) severity).`);
  }
  
  // Key issues
  const criticalIssues = signals
    .filter(s => s.severity === 'critical' || s.severity === 'high')
    .slice(0, 3);
  
  if (criticalIssues.length > 0) {
    const issues = criticalIssues.map(i => i.explanation).join('; ');
    parts.push(`Key issues: ${issues}`);
  }
  
  // Action guidance
  if (level === 'critical') {
    parts.push('IMMEDIATE ACTION REQUIRED: Document has critical risk signals. Do not process without thorough review.');
  } else if (level === 'high') {
    parts.push('REVIEW REQUIRED: Document has significant risk indicators. Manual verification recommended before approval.');
  } else if (level === 'review') {
    parts.push('CAUTION: Document has some risk indicators. Review flagged items before processing.');
  }
  
  return parts.join(' ');
}

function countBySeverity(signals: RiskSignal[]): Record<Severity, number> {
  return {
    critical: signals.filter(s => s.severity === 'critical').length,
    high: signals.filter(s => s.severity === 'high').length,
    medium: signals.filter(s => s.severity === 'medium').length,
    low: signals.filter(s => s.severity === 'low').length,
  };
}

// ============================================================================
// Plain English Risk Explanation Generator
// ============================================================================

const SUBTYPE_EXPLANATIONS: Record<string, (sig: RiskSignal) => string> = {
  repeated_amount: (sig) => {
    const amt = sig.metadata?.amount;
    const vendors = sig.metadata?.vendor_keys?.join(', ') || 'multiple vendors';
    return `The same amount${amt ? ` (₹${Number(amt).toLocaleString('en-IN')})` : ''} appears across ${vendors}. This could indicate duplicate payments or invoice reuse.`;
  },
  vendor_frequency_spike: (sig) => {
    const vendor = sig.metadata?.vendor_key || 'a vendor';
    const current = sig.metadata?.current_month_count;
    const baseline = sig.metadata?.baseline_value || sig.metadata?.previous_month_count;
    const baselineType = sig.metadata?.baseline_type || 'historical';
    return `${vendor} submitted ${current} documents this month, which is unusually high compared to the ${baselineType} average of ${baseline}. Worth checking if this reflects genuine business activity.`;
  },
  rapid_transactions: (sig) => {
    const count = sig.metadata?.transaction_count;
    const vendor = sig.metadata?.vendor_key || 'the same vendor';
    return `${count} invoices from ${vendor} arrived within just 7 days. Rapid-fire invoicing can be a sign of urgency padding or split-billing.`;
  },
  round_number_payment: (sig) => {
    const amt = sig.metadata?.amount;
    return `The payment amount ₹${Number(amt).toLocaleString('en-IN')} is a suspiciously round number. Real invoices rarely land on exact multiples — this could indicate manual adjustment.`;
  },
  circular_payment: (sig) => {
    const path = sig.metadata?.cycle_path?.join(' → ') || 'multiple entities';
    return `A circular payment loop was detected: ${path}. Money appears to flow in a circle between these entities, which is a strong indicator of round-tripping or layered fund movement.`;
  },
  threshold_exceeded: (sig) => {
    return sig.explanation || 'A configured threshold was exceeded for this document.';
  },
  gst_missing: () => {
    return 'This document is missing a GSTIN, which is required for tax compliance in India. Without it, input tax credit cannot be claimed.';
  },
  required_field_missing: (sig) => {
    return `A required field is missing from this document. ${sig.explanation || 'Please ensure all mandatory fields are populated before approval.'}`;
  },
  gst_reconciliation_mismatch: (sig) => {
    return sig.explanation || 'GST amounts on this invoice do not match the expected GSTR-2A/2B records. This discrepancy will block input tax credit claims.';
  },
};

export function generatePlainEnglishExplanations(signals: RiskSignal[]): string[] {
  if (signals.length === 0) return ['No risk signals detected. This document looks clean.'];

  const explanations: string[] = [];

  const sorted = [...signals].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  for (const sig of sorted) {
    const generator = SUBTYPE_EXPLANATIONS[sig.subtype];
    if (generator) {
      explanations.push(generator(sig));
    } else {
      explanations.push(sig.explanation || `A ${sig.severity}-severity ${sig.type} issue was detected.`);
    }
  }

  return explanations;
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

export interface AggregationResult {
  risk_score: number;
  risk_level: 'safe' | 'review' | 'high' | 'critical';
  factors: RiskSignal[];
  summary: string;
  recommendations: Recommendation[];
  plain_english_explanations: string[];
}

export function aggregateRisk(
  signals: RiskSignal[],
  options?: {
    documentId?: string;
    tenantId?: string;
  }
): AggregationResult {
  // Calculate score
  const risk_score = calculateRiskScore(signals);
  
  // Determine level
  const risk_level = determineRiskLevel(risk_score);
  
  // Aggregate recommendations
  const recommendations = aggregateRecommendations(signals);
  
  // Generate summary
  const summary = generateSummary(risk_score, risk_level, signals);

  // Generate plain English explanations
  const plain_english_explanations = generatePlainEnglishExplanations(signals);
  
  return {
    risk_score,
    risk_level,
    factors: signals,
    summary,
    recommendations,
    plain_english_explanations,
  };
}

// ============================================================================
// Risk Comparison Utilities
// ============================================================================

export function compareRiskLevels(
  level1: string,
  level2: string
): number {
  const order = ['safe', 'review', 'high', 'critical'];
  const idx1 = order.indexOf(level1);
  const idx2 = order.indexOf(level2);
  return idx1 - idx2;
}

export function isRiskAcceptable(
  score: number,
  threshold: number = 60
): boolean {
  return score <= threshold;
}
