/**
 * Risk Engine Database Helpers
 * Unified Risk Intelligence System storage layer
 */

import { pool } from '../db/pgvector.js';
import type { 
  RiskSignal, 
  RiskSignalInput, 
  DynamicRule, 
  RiskResult,
  RuleConfig,
  RuleType 
} from './types.js';

// ============================================================================
// Risk Signal Operations
// ============================================================================

export async function insertRiskSignal(input: RiskSignalInput): Promise<RiskSignal | null> {
  const result = await pool.query(
    `INSERT INTO risk_signals 
     (tenant_id, document_id, type, subtype, severity, confidence, weight, explanation, recommendation, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.tenant_id,
      input.document_id,
      input.type,
      input.subtype,
      input.severity,
      input.confidence,
      input.weight,
      input.explanation,
      JSON.stringify(input.recommendation),
      JSON.stringify(input.metadata || {}),
    ]
  );
  return (result.rows[0] as unknown as RiskSignal) || null;
}

export async function insertRiskSignals(inputs: RiskSignalInput[]): Promise<RiskSignal[]> {
  if (inputs.length === 0) return [];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted: RiskSignal[] = [];
    
    for (const input of inputs) {
      const result = await client.query(
        `INSERT INTO risk_signals 
         (tenant_id, document_id, type, subtype, severity, confidence, weight, explanation, recommendation, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.tenant_id,
          input.document_id,
          input.type,
          input.subtype,
          input.severity,
          input.confidence,
          input.weight,
          input.explanation,
          JSON.stringify(input.recommendation),
          JSON.stringify(input.metadata || {}),
        ]
      );
      if (result.rows[0]) inserted.push(result.rows[0] as unknown as RiskSignal);
    }
    
    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getRiskSignalsByDocument(
  tenantId: string, 
  documentId: string
): Promise<RiskSignal[]> {
  const result = await pool.query(
    `SELECT * FROM risk_signals 
     WHERE tenant_id = $1 AND document_id = $2
     ORDER BY created_at DESC`,
    [tenantId, documentId]
  );
  return result.rows as unknown as RiskSignal[];
}

export async function getRiskSignalsByTenant(
  tenantId: string,
  options?: { 
    documentId?: string; 
    type?: string; 
    severity?: string;
    limit?: number;
    offset?: number;
  }
): Promise<RiskSignal[]> {
  let query = `SELECT * FROM risk_signals WHERE tenant_id = $1`;
  const params: any[] = [tenantId];
  let paramIndex = 2;
  
  if (options?.documentId) {
    query += ` AND document_id = $${paramIndex}`;
    params.push(options.documentId);
    paramIndex++;
  }
  
  if (options?.type) {
    query += ` AND type = $${paramIndex}`;
    params.push(options.type);
    paramIndex++;
  }
  
  if (options?.severity) {
    query += ` AND severity = $${paramIndex}`;
    params.push(options.severity);
    paramIndex++;
  }
  
  query += ` ORDER BY created_at DESC`;
  
  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }
  
  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
    paramIndex++;
  }
  
  const result = await pool.query(query, params);
  return result.rows as unknown as RiskSignal[];
}

export async function deleteRiskSignalsByDocument(
  tenantId: string, 
  documentId: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM risk_signals 
     WHERE tenant_id = $1 AND document_id = $2`,
    [tenantId, documentId]
  );
  return result.rowCount || 0;
}

// ============================================================================
// Dynamic Rules Operations
// ============================================================================

export async function createDynamicRule(params: {
  tenant_id: string;
  name: string;
  rule_type: RuleType;
  config: RuleConfig;
  severity: string;
  weight: number;
}): Promise<DynamicRule | null> {
  const result = await pool.query(
    `INSERT INTO dynamic_rules 
     (tenant_id, name, rule_type, config, severity, weight)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.tenant_id,
      params.name,
      params.rule_type,
      JSON.stringify(params.config),
      params.severity,
      params.weight,
    ]
  );
  return (result.rows[0] as unknown as DynamicRule) || null;
}

export async function getDynamicRulesByTenant(
  tenantId: string,
  options?: { is_active?: boolean }
): Promise<DynamicRule[]> {
  let query = `SELECT * FROM dynamic_rules WHERE tenant_id = $1`;
  const params: any[] = [tenantId];
  
  if (options?.is_active !== undefined) {
    query += ` AND is_active = $2`;
    params.push(options.is_active);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    ...row,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
  })) as unknown as DynamicRule[];
}

export async function getDynamicRuleById(
  tenantId: string, 
  ruleId: string
): Promise<DynamicRule | null> {
  const result = await pool.query(
    `SELECT * FROM dynamic_rules WHERE tenant_id = $1 AND id = $2`,
    [tenantId, ruleId]
  );
  if (!result.rows[0]) return null;
  return {
    ...result.rows[0],
    config: typeof result.rows[0].config === 'string' 
      ? JSON.parse(result.rows[0].config) 
      : result.rows[0].config,
  } as DynamicRule;
}

export async function updateDynamicRule(
  tenantId: string,
  ruleId: string,
  updates: Partial<{
    name: string;
    config: RuleConfig;
    severity: string;
    weight: number;
    is_active: boolean;
  }>
): Promise<DynamicRule | null> {
  const sets: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    sets.push(`name = $${paramIndex}`);
    values.push(updates.name);
    paramIndex++;
  }
  if (updates.config !== undefined) {
    sets.push(`config = $${paramIndex}`);
    values.push(JSON.stringify(updates.config));
    paramIndex++;
  }
  if (updates.severity !== undefined) {
    sets.push(`severity = $${paramIndex}`);
    values.push(updates.severity);
    paramIndex++;
  }
  if (updates.weight !== undefined) {
    sets.push(`weight = $${paramIndex}`);
    values.push(updates.weight);
    paramIndex++;
  }
  if (updates.is_active !== undefined) {
    sets.push(`is_active = $${paramIndex}`);
    values.push(updates.is_active);
    paramIndex++;
  }
  
  if (sets.length === 0) return null;
  
  sets.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(tenantId, ruleId);
  
  const result = await pool.query(
    `UPDATE dynamic_rules 
     SET ${sets.join(', ')}
     WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
     RETURNING *`,
    values
  );
  
  if (!result.rows[0]) return null;
  return {
    ...result.rows[0],
    config: typeof result.rows[0].config === 'string' 
      ? JSON.parse(result.rows[0].config) 
      : result.rows[0].config,
  } as DynamicRule;
}

export async function deleteDynamicRule(
  tenantId: string, 
  ruleId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM dynamic_rules WHERE tenant_id = $1 AND id = $2`,
    [tenantId, ruleId]
  );
  return (result.rowCount || 0) > 0;
}

// ============================================================================
// Risk Results Operations
// ============================================================================

export async function upsertRiskResult(params: {
  tenant_id: string;
  document_id: string;
  risk_score: number;
  risk_level: string;
  factors: RiskSignal[];
  summary: string;
  recommendations: any[];
}): Promise<RiskResult | null> {
  const result = await pool.query(
    `INSERT INTO risk_results 
     (tenant_id, document_id, risk_score, risk_level, factors, summary, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, document_id) 
     DO UPDATE SET 
       risk_score = EXCLUDED.risk_score,
       risk_level = EXCLUDED.risk_level,
       factors = EXCLUDED.factors,
       summary = EXCLUDED.summary,
       recommendations = EXCLUDED.recommendations,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      params.tenant_id,
      params.document_id,
      params.risk_score,
      params.risk_level,
      JSON.stringify(params.factors),
      params.summary,
      JSON.stringify(params.recommendations),
    ]
  );
  if (!result.rows[0]) return null;
  return {
    ...result.rows[0],
    factors: typeof result.rows[0].factors === 'string' 
      ? JSON.parse(result.rows[0].factors) 
      : result.rows[0].factors,
    recommendations: typeof result.rows[0].recommendations === 'string'
      ? JSON.parse(result.rows[0].recommendations)
      : result.rows[0].recommendations,
  } as RiskResult;
}

export async function getRiskResult(
  tenantId: string, 
  documentId: string
): Promise<RiskResult | null> {
  const result = await pool.query(
    `SELECT * FROM risk_results WHERE tenant_id = $1 AND document_id = $2`,
    [tenantId, documentId]
  );
  if (!result.rows[0]) return null;
  return {
    ...result.rows[0],
    factors: typeof result.rows[0].factors === 'string' 
      ? JSON.parse(result.rows[0].factors) 
      : result.rows[0].factors,
    recommendations: typeof result.rows[0].recommendations === 'string'
      ? JSON.parse(result.rows[0].recommendations)
      : result.rows[0].recommendations,
  } as RiskResult;
}

export async function deleteRiskResult(
  tenantId: string, 
  documentId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM risk_results WHERE tenant_id = $1 AND document_id = $2`,
    [tenantId, documentId]
  );
  return (result.rowCount || 0) > 0;
}

// ============================================================================
// Tenant Document Data for Pattern Detection
// ============================================================================

export async function getDocumentsForPatternDetection(
  tenantId: string,
  options?: {
    vendorKey?: string;
    dateRange?: { from: string; to: string };
    limit?: number;
  }
): Promise<Array<{
  id: string;
  filename: string;
  extracted_data: Record<string, any>;
  uploaded_at: string;
}>> {
  let query = `
    SELECT d.id, d.filename, d.extracted_data, d.uploaded_at
    FROM documents d
    WHERE d.tenant_id = $1
  `;
  const params: any[] = [tenantId];
  let paramIndex = 2;
  
  if (options?.vendorKey) {
    query += ` AND (d.extracted_data->>'vendorKey' = $${paramIndex} OR d.extracted_data->>'vendor_gstin' = $${paramIndex})`;
    params.push(options.vendorKey);
    paramIndex++;
  }
  
  if (options?.dateRange) {
    query += ` AND d.uploaded_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    params.push(options.dateRange.from, options.dateRange.to);
    paramIndex += 2;
  }
  
  query += ` ORDER BY d.uploaded_at DESC`;
  
  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }
  
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    ...row,
    extracted_data: typeof row.extracted_data === 'string' 
      ? JSON.parse(row.extracted_data) 
      : row.extracted_data || {},
  })) as unknown as Array<{
    id: string;
    filename: string;
    extracted_data: Record<string, any>;
    uploaded_at: string;
  }>;
}
