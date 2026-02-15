import type { ExtractedFinancialData } from './financialExtraction.js';
import type { RiskAnalysis } from './classifier.js';

export interface RiskScoreResult {
  score: number; // 0-100
  highlights: string[];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * MVP risk score heuristic.
 * - Combines LLM risk classification + missing/ambiguous field checks.
 * - Score semantics: higher = riskier.
 */
export function computeRiskScore(params: {
  extracted: ExtractedFinancialData;
  classification: RiskAnalysis;
}): RiskScoreResult {
  const { extracted, classification } = params;

  const highlights: string[] = [];

  let scoreBase = 20;
  if (classification.riskLevel === 'Warning') scoreBase = 55;
  if (classification.riskLevel === 'Critical') scoreBase = 80;

  let score = scoreBase;

  // Missing-field penalties
  if (extracted.documentType === 'INVOICE') {
    if (!extracted.invoiceNumber) {
      score += 8;
      highlights.push('Invoice number missing');
    }
    if (!extracted.invoiceDate) {
      score += 10;
      highlights.push('Invoice date missing');
    }
    if (extracted.totalAmount == null) {
      score += 12;
      highlights.push('Total amount not detected');
    }
    if (!extracted.vendorGstin) {
      score += 8;
      highlights.push('Vendor GSTIN not detected');
    }
  }

  if (extracted.documentType === 'BANK_STATEMENT') {
    if (!extracted.periodStart || !extracted.periodEnd) {
      score += 10;
      highlights.push('Statement period not clearly detected');
    }
  }

  if (extracted.documentType === 'GST') {
    if (!extracted.vendorGstin && !extracted.customerGstin) {
      score += 8;
      highlights.push('GSTIN not detected');
    }
  }

  // Confidence scaling (low confidence -> slightly higher risk)
  const conf = typeof classification.confidence === 'number' ? classification.confidence : 0.5;
  if (conf < 0.6) {
    score += 5;
    highlights.push('Low confidence extraction/classification — verify manually');
  }

  // Explanation-derived highlight (keep short)
  if (classification.explanation) {
    highlights.push(classification.explanation.slice(0, 140));
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    highlights: highlights.slice(0, 6),
  };
}
