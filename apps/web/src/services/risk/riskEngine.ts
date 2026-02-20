/**
 * Risk Engine – CA.Dynamix Decision Workspace
 * Orchestrates rule engine, pattern engine, and (future) AI engine.
 * Computes unified risk score and level.
 */

import { SEVERITY_WEIGHT, SCORE_TO_LEVEL, type RiskSignal, type RiskResult } from './types';
import { evaluateRules } from './ruleEngine';
import { generatePatternSignals, generateVendorFolderSignals } from './patternEngine';
import { compareDocuments } from './crossDocumentEngine';
import { analyzeDocumentWithAI } from './aiEngine';
import type { RuleRecord } from '../../mock/types';

export interface DocumentForRisk {
  id: string;
  tenant_id?: string;
  workspaceId?: string;
  amount?: number;
  vendor?: string;
  gst?: string;
  date?: string;
  docType?: string;
  linkedDocumentIds?: string[];
  [key: string]: unknown;
}

export interface CalculateRiskInput {
  document: DocumentForRisk;
  rules: RuleRecord[];
  allTenantDocs: DocumentForRisk[];
  tenantId: string;
  /** Optional: linked document IDs for cross-document comparison */
  linkedDocumentIds?: string[];
  /** Optional: run AI analysis (Phase 5) */
  runAI?: boolean;
  /** Optional: existing folder names for vendor organization */
  existingFolders?: string[];
}

/**
 * Compute weighted score from signals (0–100).
 * Higher severity signals contribute more.
 */
function computeScoreFromSignals(signals: RiskSignal[]): number {
  if (signals.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const sig of signals) {
    const w = SEVERITY_WEIGHT[sig.severity] ?? 25;
    // Handle both new confidence and legacy confidenceScore
    const conf = (sig.confidence || sig.confidenceScore || 0) / 100;
    weightedSum += w * conf;
    totalWeight += w;
  }

  const raw = totalWeight > 0 ? (weightedSum / totalWeight) * (1 + Math.min(signals.length * 0.05, 0.5)) : 0;
  return Math.min(100, Math.round(raw));
}

/**
 * Add base score from document attributes (amount, type) when few signals.
 */
function baseScoreFromDocument(doc: DocumentForRisk): number {
  const amount = doc.amount ?? 0;

  if (amount < 20000) return 10 + Math.floor(Math.random() * 15);
  if (amount < 50000) return 30 + Math.floor(Math.random() * 20);
  if (amount < 100000) return 50 + Math.floor(Math.random() * 25);
  if (amount < 500000) return 65 + Math.floor(Math.random() * 20);
  return 75 + Math.floor(Math.random() * 25);
}

/**
 * Aggregate recommendations from signals (deduplicated).
 */
function aggregateRecommendations(signals: RiskSignal[]): string[] {
  const seen = new Set<string>();
  const recs: string[] = [];
  for (const sig of signals) {
    // Handle both new structured recommendation and legacy string recommendation
    let r = '';
    if (typeof sig.recommendation === 'string') {
      r = sig.recommendation.trim();
    } else if (sig.recommendation && typeof sig.recommendation === 'object' && 'reason' in sig.recommendation) {
      r = sig.recommendation.reason;
    }
    
    if (r && !seen.has(r)) {
      seen.add(r);
      recs.push(r);
    }
  }
  return recs;
}

/**
 * Calculate risk for a document (sync).
 * Collects signals from rule engine, pattern engine, and cross-document. Use calculateRiskAsync for AI.
 */
export function calculateRisk(input: CalculateRiskInput): RiskResult {
  return calculateRiskInternal(input, []);
}

/**
 * Calculate risk with optional AI analysis (async). Set runAI: true to call backend AI.
 */
export async function calculateRiskAsync(input: CalculateRiskInput): Promise<RiskResult> {
  let aiSignals: RiskSignal[] = [];
  if (input.runAI) {
    aiSignals = await analyzeDocumentWithAI({
      id: input.document.id,
      tenantId: input.document.tenant_id || input.document.workspaceId || input.tenantId,
      name: (input.document as Record<string, unknown>).name as string,
      docType: input.document.docType,
      amount: input.document.amount,
      vendor: input.document.vendor,
      gst: input.document.gst,
      date: input.document.date,
      textContent: (input.document as Record<string, unknown>).textContent as string,
    });
  }
  return calculateRiskInternal(input, aiSignals);
}

function calculateRiskInternal(input: CalculateRiskInput, aiSignals: RiskSignal[]): RiskResult {
  const { document, rules, allTenantDocs, tenantId } = input;
  const tenant = document.tenant_id || document.workspaceId || tenantId;

  const docForRules = {
    id: document.id,
    tenantId: tenant,
    amount: document.amount,
    vendor: document.vendor,
    gst: document.gst,
    date: document.date,
    docType: document.docType,
  };

  const ruleSignals = evaluateRules(rules, docForRules, tenant);

  // Built-in: Invoice with missing/invalid GST always gets a signal (even without user-created rule)
  const docType = (document.docType || 'Other').toString().toLowerCase();
  const gstVal = String(document.gst ?? '').trim().toUpperCase();
  const gstMissing =
    (docType === 'invoice' || docType === 'gst') &&
    (gstVal === '' || gstVal === 'NA' || gstVal === 'N/A' || gstVal === '-' || gstVal === 'NIL');
  if (gstMissing && !ruleSignals.some((s) => s.title?.toLowerCase().includes('gst'))) {
    ruleSignals.push({
      id: `sig-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      documentId: document.id,
      tenantId: tenant,
      type: 'RULE',
      subtype: 'missing_gst',
      severity: 'MEDIUM',
      confidence: 100,
      weight: 25,
      explanation: 'Required field "GST" is missing or empty. Add GSTIN before approval.',
      recommendation: {
        action: 'hold',
        reason: 'Add GST to the document before approval.',
        priority: 1
      },
      impact: 'compliance',
      evidence: ['Missing GST field'],
      suggestedAction: 'hold',
      metadata: {
        evidence: ['missing_gst'],
        fields: ['GST'],
        documentIds: [document.id]
      },
      createdAt: new Date().toISOString(),
      field: 'GST',
      title: 'GST required',
      description: 'Required field "GST" is missing or empty. Add GSTIN before approval.',
      confidenceScore: 100,
    });
  }
  const patternDocs = allTenantDocs.map((d) => ({
    id: d.id,
    tenantId: d.tenant_id || d.workspaceId || tenantId,
    amount: d.amount,
    vendor: d.vendor,
    date: d.date,
  }));
  const patternSignals = generatePatternSignals(document, patternDocs, tenant);

  // Generate vendor folder organization signals for better UX
  const vendorFolderSignals = generateVendorFolderSignals(
    document, 
    allTenantDocs, 
    tenant, 
    input.existingFolders
  );

  const linkedIds = input.linkedDocumentIds || document.linkedDocumentIds || [];
  const linkedDocs = linkedIds.length > 0
    ? [document, ...allTenantDocs.filter((d) => linkedIds.includes(d.id))]
    : [document];
  const crossSignals = compareDocuments(
    linkedDocs.map((d) => ({ id: d.id, tenantId: d.tenant_id || d.workspaceId || tenantId, amount: d.amount, vendor: d.vendor, gst: d.gst, docType: d.docType })),
    tenant,
    document.id
  );

  const allSignals = [...ruleSignals, ...patternSignals, ...vendorFolderSignals, ...crossSignals, ...aiSignals];

  let score = computeScoreFromSignals(allSignals);
  if (allSignals.length === 0) {
    score = baseScoreFromDocument(document);
  } else {
    const base = baseScoreFromDocument(document);
    score = Math.round((score * 0.7) + (base * 0.3));
    score = Math.min(100, score);
  }

  const level = SCORE_TO_LEVEL(score);
  const recommendations = aggregateRecommendations(allSignals);

  if (recommendations.length === 0 && (level === 'HIGH' || level === 'CRITICAL')) {
    recommendations.push('Obtain supporting documents (PO, contract) before approval.');
  }

  return {
    documentId: document.id,
    tenantId: tenant,
    score,
    level,
    signals: allSignals,
    recommendations,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Map RiskResult to existing DocumentRecord format (for backward compatibility).
 */
export function riskResultToDocumentFields(result: RiskResult): {
  riskScore: number;
  riskLevel: string;
  risk_level: string;
  summary: string;
  issues: Array<{ id: string; severity: 'Low' | 'Medium' | 'High' | 'Critical'; title: string; explanation: string; recommendation: string }>;
  recommendations: Array<{ id: string; text: string }>;
  mismatches: Array<{ field: string; sourceA: string; sourceB: string }>;
  patternAlerts: string[];
  riskSignals?: RiskSignal[];
} {
  const levelMap: Record<string, string> = {
    SAFE: 'Safe',
    REVIEW: 'Review Required',
    HIGH: 'High',
    CRITICAL: 'Critical',
  };
  const levelV2Map: Record<string, string> = {
    SAFE: 'safe',
    REVIEW: 'review',
    HIGH: 'high',
    CRITICAL: 'critical',
  };

  const severityMap: Record<string, 'Low' | 'Medium' | 'High' | 'Critical'> = {
    LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
  };
  const issues = result.signals.map((s) => ({
    id: s.id,
    severity: severityMap[s.severity] ?? 'Medium',
    title: s.title || s.explanation || 'Unknown Issue',
    explanation: s.explanation || s.description || '',
    recommendation: typeof s.recommendation === 'string' 
      ? s.recommendation 
      : s.recommendation?.reason || 'Review document',
  }));

  const mismatches = result.signals
    .filter((s) => s.field && (s.sourceA || s.sourceB))
    .map((s) => ({
      field: s.field || 'Unknown',
      sourceA: s.sourceA || '',
      sourceB: s.sourceB || '',
    }));

  const summary =
    result.signals.length > 0
      ? `Risk score ${result.score} (${levelMap[result.level]}). ${result.signals.length} issue(s) detected: ${result.signals.map((s) => s.title || s.explanation || 'Unknown').filter(Boolean).join('; ')}. ${result.recommendations[0] || 'Review before approval.'}`
      : result.level === 'HIGH' || result.level === 'CRITICAL'
        ? `Risk score ${result.score} (${levelMap[result.level]}). Elevated risk from document attributes (amount, type). Review before approval.`
        : `Document analyzed. Risk score ${result.score} (${levelMap[result.level]}). No issues detected.`;

  return {
    riskScore: result.score,
    riskLevel: levelMap[result.level] || 'Review Required',
    risk_level: levelV2Map[result.level] || 'review',
    summary,
    issues,
    recommendations: result.recommendations.map((text, i) => ({
      id: `rec-${result.documentId}-${i}`,
      text: text || '',
    })),
    mismatches,
    patternAlerts: result.signals.filter((s) => s.type === 'PATTERN').map((s) => s.title || s.explanation || '').filter(Boolean),
    riskSignals: result.signals,
  };
}
