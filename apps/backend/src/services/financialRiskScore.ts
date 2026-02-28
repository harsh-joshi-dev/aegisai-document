import type { ExtractedFinancialData } from './financialExtraction.js';
import type { RiskAnalysis } from './classifier.js';

export interface RiskScoreResult {
  score: number; // 0-100
  highlights: string[];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getRawArrayLength(rawMatches: Record<string, unknown> | undefined, key: string): number {
  if (!rawMatches) return 0;
  const value = rawMatches[key];
  return Array.isArray(value) ? value.length : 0;
}

function hasGstEvidence(extracted: ExtractedFinancialData): boolean {
  const raw = extracted.rawMatches as Record<string, unknown> | undefined;
  const gstCount = getRawArrayLength(raw, 'gstins');
  return Boolean(
    extracted.vendorGstin ||
      extracted.customerGstin ||
      extracted.gstAmount != null ||
      extracted.cgstAmount != null ||
      extracted.sgstAmount != null ||
      extracted.igstAmount != null ||
      extracted.cgstRate != null ||
      extracted.sgstRate != null ||
      extracted.igstRate != null ||
      extracted.hsnCode ||
      gstCount > 0
  );
}

function approxEqual(a: number, b: number, tolerancePct: number): boolean {
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  const diffPct = (Math.abs(a - b) / base) * 100;
  return diffPct <= tolerancePct;
}

type MaterialityBand = 'micro' | 'sme' | 'mid_market' | 'enterprise';

interface MaterialityProfile {
  band: MaterialityBand;
  invoicePenaltyCap: number;
  gstPenaltyCap: number;
  bankPenaltyCap: number;
  reconciliationTolerancePct: number;
  penaltyMultiplier: number;
}

function getMaterialityProfile(extracted: ExtractedFinancialData): MaterialityProfile {
  const amount = extracted.totalAmount ?? extracted.taxableAmount ?? 0;

  if (amount <= 100000) {
    return {
      band: 'micro',
      invoicePenaltyCap: 20,
      gstPenaltyCap: 16,
      bankPenaltyCap: 12,
      reconciliationTolerancePct: 4.0,
      penaltyMultiplier: 0.85,
    };
  }

  if (amount <= 1000000) {
    return {
      band: 'sme',
      invoicePenaltyCap: 28,
      gstPenaltyCap: 20,
      bankPenaltyCap: 16,
      reconciliationTolerancePct: 2.5,
      penaltyMultiplier: 1.0,
    };
  }

  if (amount <= 10000000) {
    return {
      band: 'mid_market',
      invoicePenaltyCap: 34,
      gstPenaltyCap: 24,
      bankPenaltyCap: 18,
      reconciliationTolerancePct: 1.8,
      penaltyMultiplier: 1.12,
    };
  }

  return {
    band: 'enterprise',
    invoicePenaltyCap: 40,
    gstPenaltyCap: 28,
    bankPenaltyCap: 20,
    reconciliationTolerancePct: 1.2,
    penaltyMultiplier: 1.25,
  };
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
  if (classification.riskLevel === 'Warning') scoreBase = 50;
  if (classification.riskLevel === 'Critical') scoreBase = 72;

  let score = scoreBase;
  const conf = typeof classification.confidence === 'number' ? classification.confidence : 0.5;
  const materiality = getMaterialityProfile(extracted);

  // Missing-field penalties
  if (extracted.documentType === 'INVOICE') {
    let invoicePenalty = 0;
    const hasTaxContext = hasGstEvidence(extracted);

    if (!extracted.invoiceNumber) {
      invoicePenalty += 6 * materiality.penaltyMultiplier;
      highlights.push('Invoice number missing');
    }
    if (!extracted.invoiceDate) {
      invoicePenalty += 8 * materiality.penaltyMultiplier;
      highlights.push('Invoice date missing');
    }
    if (extracted.totalAmount == null) {
      invoicePenalty += 10 * materiality.penaltyMultiplier;
      highlights.push('Total amount not detected');
    }

    // GSTIN is material only when document is clearly GST/tax relevant.
    if (hasTaxContext && !extracted.vendorGstin) {
      invoicePenalty += 6 * materiality.penaltyMultiplier;
      highlights.push('GST context found but vendor GSTIN not detected');
    }

    // Arithmetic consistency check (CA-style): taxable + GST should reconcile with total.
    if (
      extracted.totalAmount != null &&
      extracted.taxableAmount != null &&
      extracted.gstAmount != null
    ) {
      const expectedTotal = extracted.taxableAmount + extracted.gstAmount;
      if (!approxEqual(extracted.totalAmount, expectedTotal, materiality.reconciliationTolerancePct)) {
        invoicePenalty += 10 * materiality.penaltyMultiplier;
        highlights.push('Tax reconciliation mismatch: taxable + GST does not match total');
      }
    }

    // Chronology sanity: due date should not be before invoice date.
    const invoiceDate = parseIsoDate(extracted.invoiceDate);
    const dueDate = parseIsoDate(extracted.dueDate);
    if (invoiceDate && dueDate && dueDate < invoiceDate) {
      invoicePenalty += 6 * materiality.penaltyMultiplier;
      highlights.push('Due date is earlier than invoice date');
    }

    // Materiality cap to prevent over-penalizing sparse/noisy extraction.
    score += Math.min(invoicePenalty, materiality.invoicePenaltyCap);
  }

  if (extracted.documentType === 'BANK_STATEMENT') {
    let bankPenalty = 0;

    if (!extracted.periodStart || !extracted.periodEnd) {
      bankPenalty += 8 * materiality.penaltyMultiplier;
      highlights.push('Statement period not clearly detected');
    }

    const periodStart = parseIsoDate(extracted.periodStart);
    const periodEnd = parseIsoDate(extracted.periodEnd);
    if (periodStart && periodEnd && periodEnd < periodStart) {
      bankPenalty += 8 * materiality.penaltyMultiplier;
      highlights.push('Statement period end date is earlier than start date');
    }

    score += Math.min(bankPenalty, materiality.bankPenaltyCap);
  }

  if (extracted.documentType === 'GST') {
    let gstPenalty = 0;

    if (!extracted.vendorGstin && !extracted.customerGstin) {
      gstPenalty += 8 * materiality.penaltyMultiplier;
      highlights.push('GSTIN not detected');
    }

    if (extracted.taxableAmount != null && extracted.gstAmount != null && extracted.totalAmount != null) {
      const expectedTotal = extracted.taxableAmount + extracted.gstAmount;
      if (!approxEqual(extracted.totalAmount, expectedTotal, materiality.reconciliationTolerancePct)) {
        gstPenalty += 10 * materiality.penaltyMultiplier;
        highlights.push('GST return/invoice values appear mathematically inconsistent');
      }
    }

    score += Math.min(gstPenalty, materiality.gstPenaltyCap);
  }

  // Confidence scaling: low confidence should trigger review but not aggressively distort score.
  if (conf < 0.6) {
    score += 3;
    highlights.push('Low confidence in extracted fields — manual verification advised');
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
