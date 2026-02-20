/**
 * Rule Engine – CA.Dynamix Decision Workspace
 * Evaluates rules against documents and emits RiskSignals.
 */

import type { RiskSignal, RiskSignalSeverity } from './types';
import type { RuleRecord } from '../../mock/types';

export interface DocumentForRules {
  id: string;
  tenantId: string;
  amount?: number;
  vendor?: string;
  gst?: string;
  date?: string;
  docType?: string;
  [key: string]: unknown;
}

function severityToSignal(severity: string): RiskSignalSeverity {
  const s = (severity || 'Medium').toUpperCase();
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s as RiskSignalSeverity;
  if (s === 'MED') return 'MEDIUM';
  return 'MEDIUM';
}

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return `sig-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Threshold Rule: amount > X, amount < X, amount >= X, amount <= X
 * Config format: "amount > 100000" | "amount < 5000" | "amount >= 50000"
 */
function evaluateThreshold(
  rule: RuleRecord,
  doc: DocumentForRules,
  tenantId: string
): RiskSignal | null {
  const config = (rule.config || '').trim().toLowerCase();
  const amount = doc.amount ?? 0;

  const match = config.match(/amount\s*(>|<|>=|<=|==|!=)\s*([\d,]+)/);
  if (!match) return null;

  const op = match[1];
  const threshold = Number(match[2].replace(/,/g, ''));

  let triggered = false;
  switch (op) {
    case '>':
      triggered = amount > threshold;
      break;
    case '<':
      triggered = amount < threshold;
      break;
    case '>=':
      triggered = amount >= threshold;
      break;
    case '<=':
      triggered = amount <= threshold;
      break;
    case '==':
      triggered = amount === threshold;
      break;
    case '!=':
      triggered = amount !== threshold;
      break;
    default:
      return null;
  }

  if (!triggered) return null;

  return {
    id: id(),
    documentId: doc.id,
    tenantId,
    type: 'RULE',
    subtype: 'threshold_violation',
    severity: severityToSignal(rule.severity),
    confidence: 90,
    weight: rule.weight || 25,
    explanation: `Amount ₹${amount.toLocaleString('en-IN')} triggered threshold rule: ${rule.config}`,
    recommendation: {
      action: 'verify',
      reason: `Verify amount against policy. Rule: ${rule.config}`,
      priority: 2
    },
    impact: 'financial',
    evidence: [`Amount: ₹${amount.toLocaleString('en-IN')}`, `Rule: ${rule.config}`],
    suggestedAction: 'verify',
    metadata: {
      evidence: [`threshold_${amount}_${rule.config}`],
      fields: ['Amount'],
      documentIds: [doc.id]
    },
    createdAt: now(),
    title: rule.name,
    description: `Amount ₹${amount.toLocaleString('en-IN')} triggered threshold rule: ${rule.config}`,
    confidenceScore: 90,
  };
}

/**
 * Required Field Rule: field must be present and non-empty
 * Config format: "gst" | "vendor" | "amount" | "date"
 */
function evaluateRequiredField(
  rule: RuleRecord,
  doc: DocumentForRules,
  tenantId: string
): RiskSignal | null {
  const config = (rule.config || '').trim().toLowerCase();
  const field = config.split(/\s+/)[0] || 'gst';

  const value = (doc as Record<string, unknown>)[field];
  const str = String(value ?? '').trim().toUpperCase();
  const empty =
    value === undefined ||
    value === null ||
    str === '' ||
    str === 'NA' ||
    str === 'N/A' ||
    str === '-' ||
    str === 'NIL';

  if (!empty) return null;

  const fieldLabel = field.charAt(0).toUpperCase() + field.slice(1);
  return {
    id: id(),
    documentId: doc.id,
    tenantId,
    type: 'RULE',
    subtype: 'missing_field',
    severity: severityToSignal(rule.severity),
    confidence: 100,
    weight: rule.weight || 25,
    explanation: `Required field "${fieldLabel}" is missing or empty.`,
    recommendation: {
      action: 'hold',
      reason: `Add ${fieldLabel} to the document before approval.`,
      priority: 1
    },
    impact: 'compliance',
    evidence: [`Missing field: ${fieldLabel}`],
    suggestedAction: 'hold',
    metadata: {
      evidence: [`missing_field_${field}`],
      fields: [fieldLabel],
      documentIds: [doc.id]
    },
    createdAt: now(),
    field: fieldLabel,
    title: rule.name,
    description: `Required field "${fieldLabel}" is missing or empty.`,
    confidenceScore: 100,
  };
}

/**
 * Consistency Rule: cross-field or cross-doc check
 * Config format: "amount > 0" | "gst valid" | "vendor not empty"
 * For now, simple single-doc checks.
 */
function evaluateConsistency(
  rule: RuleRecord,
  doc: DocumentForRules,
  tenantId: string
): RiskSignal | null {
  const config = (rule.config || '').trim().toLowerCase();

  if (config.includes('amount') && config.includes('>') && config.includes('0')) {
    const amount = doc.amount ?? 0;
    if (amount <= 0) {
      return {
        id: id(),
        documentId: doc.id,
        tenantId,
        type: 'RULE',
        subtype: 'invalid_amount',
        severity: severityToSignal(rule.severity),
        confidence: 100,
        weight: rule.weight || 25,
        explanation: 'Amount must be greater than zero.',
        recommendation: {
          action: 'reject',
          reason: 'Verify amount is correctly entered.',
          priority: 1
        },
        impact: 'financial',
        evidence: [`Amount: ${amount}`],
        suggestedAction: 'reject',
        metadata: {
          evidence: [`invalid_amount_${amount}`],
          fields: ['Amount'],
          documentIds: [doc.id]
        },
        createdAt: now(),
        title: rule.name,
        description: 'Amount must be greater than zero.',
        confidenceScore: 100,
      };
    }
  }

  if (config.includes('gst') && (config.includes('valid') || config.includes('format'))) {
    const gst = (doc.gst ?? '').toString().trim();
    const gstPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
    if (gst && !gstPattern.test(gst)) {
      return {
        id: id(),
        documentId: doc.id,
        tenantId,
        type: 'RULE',
        subtype: 'invalid_gstin_format',
        severity: severityToSignal(rule.severity),
        confidence: 85,
        weight: rule.weight || 25,
        explanation: `GSTIN "${gst}" does not match expected format.`,
        recommendation: {
          action: 'verify',
          reason: 'Verify GSTIN against GST portal.',
          priority: 2
        },
        impact: 'compliance',
        evidence: [`GSTIN: ${gst}`, 'Expected format: 15 chars (e.g. 27AABCU9603R1ZM)'],
        suggestedAction: 'verify',
        metadata: {
          evidence: [`invalid_gstin_${gst}`],
          fields: ['GST'],
          documentIds: [doc.id]
        },
        createdAt: now(),
        field: 'GST',
        sourceA: gst,
        sourceB: 'Expected format: 15 chars (e.g. 27AABCU9603R1ZM)',
        title: rule.name,
        description: `GSTIN "${gst}" does not match expected format.`,
        confidenceScore: 85,
      };
    }
  }

  return null;
}

/**
 * Route rule to appropriate evaluator.
 */
function evaluateRule(
  rule: RuleRecord,
  doc: DocumentForRules,
  tenantId: string
): RiskSignal | null {
  const ruleType = (rule.type || '').toLowerCase();
  if (ruleType.includes('threshold')) return evaluateThreshold(rule, doc, tenantId);
  if (ruleType.includes('required') || ruleType.includes('field'))
    return evaluateRequiredField(rule, doc, tenantId);
  if (ruleType.includes('consistency')) return evaluateConsistency(rule, doc, tenantId);
  return null;
}

/**
 * Run all rules for a document and return triggered RiskSignals.
 */
export function evaluateRules(
  rules: RuleRecord[],
  doc: DocumentForRules,
  tenantId: string
): RiskSignal[] {
  const signals: RiskSignal[] = [];
  for (const rule of rules) {
    const sig = evaluateRule(rule, doc, tenantId);
    if (sig) signals.push(sig);
  }
  return signals;
}
