/**
 * Unified Risk Intelligence Service
 * Orchestrates rule execution, pattern detection, and risk aggregation
 */

import type { RiskSignal, RiskSignalInput, RiskResult } from './types.js';
import { 
  createDynamicRule,
  getDynamicRulesByTenant,
  updateDynamicRule,
  insertRiskSignals,
  deleteRiskSignalsByDocument,
  upsertRiskResult,
  getRiskSignalsByDocument,
  getRiskSignalsByTenant,
  getRiskResult,
  getDocumentsForPatternDetection,
} from './db.js';
import { executeRules, getDefaultRules } from './ruleEngine.js';
import { detectPatterns } from './patternDetection.js';
import { aggregateRisk } from './aggregator.js';

// ============================================================================
// Main Risk Analysis Orchestrator
// ============================================================================

export interface AnalyzeDocumentRiskParams {
  tenantId: string;
  documentId: string;
  extractedData: Record<string, any>;
  options?: {
    skipPatterns?: boolean;
    skipRules?: boolean;
    forceRecompute?: boolean;
  };
}

export async function analyzeDocumentRisk(
  params: AnalyzeDocumentRiskParams
): Promise<RiskResult> {
  const { tenantId, documentId, extractedData, options } = params;
  
  // Check if we have cached results and don't need to recompute
  if (!options?.forceRecompute) {
    const cached = await getRiskResult(tenantId, documentId);
    if (cached) {
      return cached;
    }
  }
  
  // Clear old signals if recomputing
  if (options?.forceRecompute) {
    await deleteRiskSignalsByDocument(tenantId, documentId);
  }
  
  const allSignals: RiskSignalInput[] = [];
  
  // Execute dynamic rules
  if (!options?.skipRules) {
    const ruleSignals = await executeDocumentRules(tenantId, documentId, extractedData);
    allSignals.push(...ruleSignals);
  }
  
  // Detect patterns
  if (!options?.skipPatterns) {
    const patternSignals = await detectDocumentPatterns(tenantId, documentId, extractedData);
    allSignals.push(...patternSignals);
  }
  
  // Store signals
  const storedSignals = await insertRiskSignals(allSignals);
  
  // Aggregate and compute final risk
  const aggregation = aggregateRisk(storedSignals as RiskSignal[], {
    documentId,
    tenantId,
  });
  
  // Store risk result
  const riskResult = await upsertRiskResult({
    tenant_id: tenantId,
    document_id: documentId,
    risk_score: aggregation.risk_score,
    risk_level: aggregation.risk_level,
    factors: storedSignals as RiskSignal[],
    summary: aggregation.summary,
    recommendations: aggregation.recommendations,
    plain_english_explanations: aggregation.plain_english_explanations,
  });
  
  if (!riskResult) {
    throw new Error('Failed to store risk result');
  }
  
  return riskResult;
}

// ============================================================================
// Component Functions
// ============================================================================

async function executeDocumentRules(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): Promise<RiskSignalInput[]> {
  // Get active rules for tenant
  const rules = await getDynamicRulesByTenant(tenantId, { is_active: true });
  
  // Execute rules
  const signals = executeRules(rules, documentId, tenantId, extractedData);
  
  return signals;
}

async function detectDocumentPatterns(
  tenantId: string,
  documentId: string,
  extractedData: Record<string, any>
): Promise<RiskSignalInput[]> {
  const signals = await detectPatterns({
    tenant_id: tenantId,
    document_id: documentId,
    extracted_data: extractedData,
    timestamp: new Date().toISOString(),
  });
  
  return signals;
}

// ============================================================================
// Bulk Analysis
// ============================================================================

export async function analyzeTenantDocuments(
  tenantId: string,
  options?: {
    documentIds?: string[];
    dateRange?: { from: string; to: string };
  }
): Promise<{ analyzed: number; errors: number }> {
  // Get documents to analyze
  const docs = await getDocumentsForPatternDetection(tenantId, {
    dateRange: options?.dateRange,
    limit: options?.documentIds ? undefined : 100,
  });
  
  const toAnalyze = options?.documentIds 
    ? docs.filter(d => options.documentIds?.includes(d.id))
    : docs;
  
  let analyzed = 0;
  let errors = 0;
  
  for (const doc of toAnalyze) {
    try {
      await analyzeDocumentRisk({
        tenantId,
        documentId: doc.id,
        extractedData: doc.extracted_data || {},
      });
      analyzed++;
    } catch (e) {
      console.error(`Failed to analyze document ${doc.id}:`, e);
      errors++;
    }
  }
  
  return { analyzed, errors };
}

// ============================================================================
// Risk Retrieval
// ============================================================================

export async function getDocumentRisk(
  tenantId: string,
  documentId: string
): Promise<RiskResult | null> {
  return getRiskResult(tenantId, documentId);
}

export async function getDocumentRiskSignals(
  tenantId: string,
  documentId: string
): Promise<RiskSignal[]> {
  return getRiskSignalsByDocument(tenantId, documentId);
}

// ============================================================================
// Rule Management Helpers
// ============================================================================

export async function ensureDefaultRules(tenantId: string): Promise<void> {
  const sync = await syncDefaultRules(tenantId);
  if (sync.created > 0 || sync.updated > 0) {
    console.log(
      `[Risk Engine] Default rule sync for tenant ${tenantId}: created=${sync.created}, updated=${sync.updated}, skipped=${sync.skipped}`
    );
  }
}

export async function syncDefaultRules(tenantId: string): Promise<{ created: number; updated: number; skipped: number }> {
  const existing = await getDynamicRulesByTenant(tenantId);
  const defaults = getDefaultRules(tenantId);
  const existingByName = new Map(existing.map((rule) => [normalizeRuleName(rule.name), rule]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const defaultRule of defaults) {
    const key = normalizeRuleName(defaultRule.name);
    const existingRule = existingByName.get(key);

    if (!existingRule) {
      const createdRule = await createDynamicRule(defaultRule);
      if (createdRule) {
        created++;
      } else {
        skipped++;
      }
      continue;
    }

    if (
      isManagedSystemDefault(existingRule.config as Record<string, any>) &&
      shouldRefreshDefaultRule(existingRule.config as Record<string, any>, defaultRule.config as Record<string, any>)
    ) {
      const updatedRule = await updateDynamicRule(tenantId, existingRule.id, {
        config: mergeDefaultConfig(existingRule.config as Record<string, any>, defaultRule.config as Record<string, any>) as any,
      });
      if (updatedRule) {
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    skipped++;
  }

  return { created, updated, skipped };
}

// ============================================================================
// Recompute Helpers
// ============================================================================

export async function recomputeDocumentRisk(
  tenantId: string,
  documentId: string
): Promise<RiskResult> {
  // Get document data
  const { pool } = await import('../db/pgvector.js');
  const result = await pool.query(
    `SELECT extracted_data FROM documents WHERE id = $1 AND tenant_id = $2`,
    [documentId, tenantId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Document not found');
  }
  
  const extractedData = typeof result.rows[0].extracted_data === 'string'
    ? JSON.parse(result.rows[0].extracted_data)
    : result.rows[0].extracted_data || {};
  
  return analyzeDocumentRisk({
    tenantId,
    documentId,
    extractedData,
    options: { forceRecompute: true },
  });
}

export async function recomputeTenantRisk(tenantId: string): Promise<{ recomputed: number; failed: number }> {
  const signals = await getRiskSignalsByTenant(tenantId, { limit: 1 });
  
  if (signals.length === 0) {
    // No previous analysis, do bulk analysis
    const result = await analyzeTenantDocuments(tenantId);
    return { recomputed: result.analyzed, failed: result.errors };
  }
  
  // Get documents with existing risk results
  const { pool } = await import('../db/pgvector.js');
  const result = await pool.query(
    `SELECT document_id FROM risk_results WHERE tenant_id = $1`,
    [tenantId]
  );
  
  const documentIds = result.rows.map((r: any) => r.document_id);
  let recomputed = 0;
  let failed = 0;
  
  for (const documentId of documentIds) {
    try {
      await recomputeDocumentRisk(tenantId, documentId);
      recomputed++;
    } catch (e) {
      console.error(`Failed to recompute risk for ${documentId}:`, e);
      failed++;
    }
  }
  
  return { recomputed, failed };
}

function normalizeRuleName(name: string): string {
  return name.trim().toLowerCase();
}

function shouldRefreshDefaultRule(
  currentConfig: Record<string, any>,
  defaultConfig: Record<string, any>
): boolean {
  const defaultDocTypes = normalizeDocumentTypes(defaultConfig.document_types);
  const currentDocTypes = normalizeDocumentTypes(currentConfig.document_types);
  const scopeChanged =
    defaultDocTypes.length > 0 && !areSameStringSets(currentDocTypes, defaultDocTypes);
  const versionChanged = getRuleVersion(currentConfig) !== getRuleVersion(defaultConfig);
  return scopeChanged || versionChanged;
}

function mergeDefaultConfig(
  currentConfig: Record<string, any>,
  defaultConfig: Record<string, any>
): Record<string, any> {
  const merged = { ...currentConfig };
  const defaultDocTypes = normalizeDocumentTypes(defaultConfig.document_types);
  if (defaultDocTypes.length > 0) {
    merged.document_types = defaultDocTypes;
  }
  if (defaultConfig.rule_metadata) {
    merged.rule_metadata = defaultConfig.rule_metadata;
  }
  return merged;
}

function normalizeDocumentTypes(documentTypes: unknown): string[] {
  if (!Array.isArray(documentTypes)) return [];
  const normalized = documentTypes
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function areSameStringSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((value) => bSet.has(value));
}

function isManagedSystemDefault(config: Record<string, any>): boolean {
  const meta = config.rule_metadata as Record<string, unknown> | undefined;
  const managedBy = typeof meta?.managed_by === 'string' ? meta.managed_by : '';
  // Backward compatible: if metadata was never set, treat as managed default so scope metadata can be backfilled.
  return managedBy === '' || managedBy === 'system_default';
}

function getRuleVersion(config: Record<string, any>): string {
  const meta = config.rule_metadata as Record<string, unknown> | undefined;
  return typeof meta?.version === 'string' ? meta.version : '';
}
