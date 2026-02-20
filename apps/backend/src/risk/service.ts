/**
 * Unified Risk Intelligence Service
 * Orchestrates rule execution, pattern detection, and risk aggregation
 */

import type { RiskSignal, RiskSignalInput, RiskResult } from './types.js';
import { 
  getDynamicRulesByTenant,
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
  const existing = await getDynamicRulesByTenant(tenantId);
  
  if (existing.length === 0) {
    // Import createDynamicRule from db
    const { createDynamicRule } = await import('./db.js');
    const defaultRules = getDefaultRules(tenantId);
    
    for (const rule of defaultRules) {
      await createDynamicRule(rule);
    }
    
    console.log(`[Risk Engine] Created ${defaultRules.length} default rules for tenant ${tenantId}`);
  }
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
