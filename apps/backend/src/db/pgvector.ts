import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
});

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: {
    page?: number;
    chunkIndex: number;
    startChar?: number;
    endChar?: number;
  };
}

export type RiskSignalType = 'mismatch' | 'rule_violation' | 'pattern' | 'missing_field';
export type RiskSignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskRecommendation = {
  action_type: 'verify' | 'request' | 'reject' | 'escalate';
  message: string;
  priority: 'low' | 'medium' | 'high';
};

export type RiskSignalRow = {
  id: string;
  tenant_id: string;
  document_id: string;
  type: RiskSignalType;
  severity: RiskSignalSeverity;
  confidence: number;
  weight: number;
  explanation: string;
  recommendation: RiskRecommendation;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

export type RiskResultRow = {
  id: string;
  tenant_id: string;
  document_id: string;
  risk_score: number;
  risk_level: 'Safe' | 'Review Required' | 'High Risk' | 'Critical';
  factors: Record<string, unknown>;
  summary: string;
  recommendations: RiskRecommendation[];
  updated_at: Date;
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'info_requested' | 'flagged';

export type ApprovalRow = {
  id: string;
  tenant_id: string;
  document_id: string;
  status: ApprovalStatus;
  reviewer_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function updateDocumentFinancialFieldsByTenant(params: {
  documentId: string;
  tenantId: string;
  extractedData?: Record<string, unknown> | null;
  riskScore?: number | null;
  summary?: string | null;
}): Promise<void> {
  const { documentId, tenantId, extractedData, riskScore, summary } = params;
  await pool.query(
    `UPDATE documents
     SET extracted_data = COALESCE($1, extracted_data),
         risk_score = COALESCE($2, risk_score),
         summary = COALESCE($3, summary)
     WHERE id = $4 AND tenant_id = $5`,
    [
      extractedData == null ? null : JSON.stringify(extractedData),
      riskScore ?? null,
      summary ?? null,
      documentId,
      tenantId,
    ]
  );
}

export async function getDocumentForProcessingByTenant(params: {
  documentId: string;
  tenantId: string;
}): Promise<
  | {
      id: string;
      filename: string;
      uploadedAt: Date | null;
      fileData: Buffer | null;
      fileType: string | null;
      createdBy: string | null;
    }
  | null
> {
  const { documentId, tenantId } = params;
  const result = await pool.query(
    `SELECT id, filename, uploaded_at, file_data, file_type, created_by
     FROM documents
     WHERE id = $1 AND tenant_id = $2`,
    [documentId, tenantId]
  );
  const row = result.rows[0] as any;
  if (!row) return null;
  return {
    id: row.id as string,
    filename: row.filename as string,
    uploadedAt: (row.uploaded_at as Date) ?? null,
    fileData: (row.file_data as Buffer) ?? null,
    fileType: (row.file_type as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
  };
}

export async function insertCustomRule(params: {
  userId: string;
  tenantId: string;
  name: string;
  description: string;
  ruleType: string;
  pattern?: string | null;
  keywords?: string[] | null;
  prompt?: string | null;
  riskLevel: string;
  enabled: boolean;
}): Promise<{ id: string } | null> {
  const result = await pool.query(
    `INSERT INTO custom_rules (tenant_id, user_id, name, description, rule_type, pattern, keywords, prompt, risk_level, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      params.tenantId,
      params.userId,
      params.name,
      params.description,
      params.ruleType,
      params.pattern ?? null,
      params.keywords ?? null,
      params.prompt ?? null,
      params.riskLevel,
      params.enabled,
    ]
  );
  return result.rows[0] ? ({ id: (result.rows[0] as any).id as string }) : null;
}

export async function listCustomRules(params: { userId: string; tenantId: string }): Promise<CustomRuleRow[]> {
  const result = await pool.query(
    `SELECT id, user_id, name, description, rule_type, pattern, keywords, prompt, risk_level, enabled, created_at, updated_at
     FROM custom_rules
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [params.tenantId]
  );
  return result.rows as any;
}

export async function deleteCustomRule(params: { userId: string; tenantId: string; ruleId: string }): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM custom_rules WHERE id = $1 AND tenant_id = $2`,
    [params.ruleId, params.tenantId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateCustomRule(params: {
  userId: string;
  tenantId: string;
  ruleId: string;
  patch: Partial<{
    name: string;
    description: string;
    ruleType: string;
    pattern: string | null;
    keywords: string[] | null;
    prompt: string | null;
    riskLevel: string;
    enabled: boolean;
  }>;
}): Promise<CustomRuleRow | null> {
  const { patch } = params;
  const result = await pool.query(
    `UPDATE custom_rules
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         rule_type = COALESCE($3, rule_type),
         pattern = COALESCE($4, pattern),
         keywords = COALESCE($5, keywords),
         prompt = COALESCE($6, prompt),
         risk_level = COALESCE($7, risk_level),
         enabled = COALESCE($8, enabled),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $9 AND tenant_id = $10
     RETURNING id, user_id, name, description, rule_type, pattern, keywords, prompt, risk_level, enabled, created_at, updated_at`,
    [
      patch.name ?? null,
      patch.description ?? null,
      patch.ruleType ?? null,
      patch.pattern ?? null,
      patch.keywords ?? null,
      patch.prompt ?? null,
      patch.riskLevel ?? null,
      typeof patch.enabled === 'boolean' ? patch.enabled : null,
      params.ruleId,
      params.tenantId,
    ]
  );
  return result.rows[0] ? (result.rows[0] as any) : null;
}

export async function ensureTenantMembership(params: {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'reviewer' | 'viewer';
}): Promise<void> {
  await pool.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
     VALUES ($1, $2, $3, 'ACTIVE')
     ON CONFLICT (tenant_id, user_id)
     DO UPDATE SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP`,
    [params.tenantId, params.userId, params.role]
  );
}

export async function getUserMembershipRole(params: {
  tenantId: string;
  userId: string;
}): Promise<'owner' | 'admin' | 'reviewer' | 'viewer' | null> {
  const result = await pool.query(
    `SELECT role FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [params.tenantId, params.userId]
  );
  const row = result.rows[0] as any;
  return row?.role ? (String(row.role) as any) : null;
}

export async function listUserWorkspaces(params: {
  userId: string;
}): Promise<Array<{ tenantId: string; name: string; role: string }>> {
  const result = await pool.query(
    `SELECT t.id as tenant_id, t.name, m.role
     FROM tenant_memberships m
     JOIN tenants t ON t.id = m.tenant_id
     WHERE m.user_id = $1 AND m.status = 'ACTIVE'
     ORDER BY t.created_at ASC`,
    [params.userId]
  );
  return (result.rows as any[]).map((r) => ({
    tenantId: r.tenant_id as string,
    name: r.name as string,
    role: r.role as string,
  }));
}

export async function upsertVendorMemory(params: {
  tenantId: string;
  actorUserId: string;
  vendorKey: string;
  vendorName?: string | null;
  vendorGstin?: string | null;
  amount: number;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT count, mean_amount, m2_amount
       FROM vendor_memory
       WHERE tenant_id = $1 AND vendor_key = $2
       FOR UPDATE`,
      [params.tenantId, params.vendorKey]
    );

    const prevCount = existing.rows[0]?.count ? Number(existing.rows[0].count) : 0;
    const prevMean = existing.rows[0]?.mean_amount != null ? Number(existing.rows[0].mean_amount) : 0;
    const prevM2 = existing.rows[0]?.m2_amount != null ? Number(existing.rows[0].m2_amount) : 0;

    const newCount = prevCount + 1;
    const delta = params.amount - prevMean;
    const newMean = prevCount === 0 ? params.amount : prevMean + delta / newCount;
    const delta2 = params.amount - newMean;
    const newM2 = prevCount === 0 ? 0 : prevM2 + delta * delta2;

    await client.query(
      `INSERT INTO vendor_memory (tenant_id, user_id, vendor_key, vendor_name, vendor_gstin, count, mean_amount, m2_amount, last_amount, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id, vendor_key)
       DO UPDATE SET
         vendor_name = COALESCE(EXCLUDED.vendor_name, vendor_memory.vendor_name),
         vendor_gstin = COALESCE(EXCLUDED.vendor_gstin, vendor_memory.vendor_gstin),
         count = $5,
         mean_amount = $6,
         m2_amount = $7,
         last_amount = $8,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        params.tenantId,
        params.actorUserId,
        params.vendorKey,
        params.vendorName ?? null,
        params.vendorGstin ?? null,
        newCount,
        newMean,
        newM2,
        params.amount,
      ]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Get folder id by name for tenant, or create folder if it doesn't exist. Returns folder id. */
export async function getOrCreateFolderByTenant(params: {
  tenantId: string;
  actorUserId: string;
  folderName: string;
}): Promise<string | null> {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM folders WHERE tenant_id = $1 AND name = $2`,
      [params.tenantId, params.folderName]
    );
    if (existing.rows.length > 0) {
      return (existing.rows[0] as { id: string }).id;
    }
    const insert = await client.query(
      `INSERT INTO folders (tenant_id, user_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [params.tenantId, params.actorUserId, params.folderName]
    );
    return insert.rows.length > 0 ? (insert.rows[0] as { id: string }).id : null;
  } finally {
    client.release();
  }
}

/** Set document's folder (or null for root) scoped by tenant. */
export async function setDocumentFolderByTenant(params: {
  documentId: string;
  tenantId: string;
  folderId: string | null;
}): Promise<void> {
  await pool.query(
    `UPDATE documents SET folder_id = $1 WHERE id = $2 AND tenant_id = $3`,
    [params.folderId, params.documentId, params.tenantId]
  );
}

export async function getApprovalForDocument(params: { tenantId: string; documentId: string }): Promise<ApprovalRow | null> {
  const result = await pool.query(
    `SELECT id, tenant_id, document_id, status, reviewer_id, notes, created_at, updated_at
     FROM approvals
     WHERE tenant_id = $1 AND document_id = $2`,
    [params.tenantId, params.documentId]
  );
  return result.rows[0] ? (result.rows[0] as any) : null;
}

export async function upsertApprovalForDocument(params: {
  tenantId: string;
  documentId: string;
  status: ApprovalStatus;
  reviewerId: string;
  notes?: string | null;
}): Promise<ApprovalRow> {
  const result = await pool.query(
    `INSERT INTO approvals (tenant_id, document_id, status, reviewer_id, notes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, document_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       reviewer_id = EXCLUDED.reviewer_id,
       notes = EXCLUDED.notes,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, tenant_id, document_id, status, reviewer_id, notes, created_at, updated_at`,
    [params.tenantId, params.documentId, params.status, params.reviewerId, params.notes ?? null]
  );
  return result.rows[0] as any;
}

export async function replaceRiskSignalsForDocument(params: {
  tenantId: string;
  documentId: string;
  signals: Array<{
    type: RiskSignalType;
    severity: RiskSignalSeverity;
    confidence: number;
    weight: number;
    explanation: string;
    recommendation: RiskRecommendation;
    metadata?: Record<string, unknown> | null;
  }>;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM risk_signals WHERE tenant_id = $1 AND document_id = $2`,
      [params.tenantId, params.documentId]
    );
    for (const s of params.signals) {
      await client.query(
        `INSERT INTO risk_signals (tenant_id, document_id, type, severity, confidence, weight, explanation, recommendation, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          params.tenantId,
          params.documentId,
          s.type,
          s.severity,
          s.confidence,
          s.weight,
          s.explanation,
          JSON.stringify(s.recommendation),
          s.metadata == null ? null : JSON.stringify(s.metadata),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function upsertRiskResult(params: {
  tenantId: string;
  documentId: string;
  riskScore: number;
  riskLevel: 'Safe' | 'Review Required' | 'High Risk' | 'Critical';
  factors: Record<string, unknown>;
  summary: string;
  recommendations: RiskRecommendation[];
}): Promise<void> {
  await pool.query(
    `INSERT INTO risk_results (tenant_id, document_id, risk_score, risk_level, factors, summary, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, document_id)
     DO UPDATE SET
       risk_score = EXCLUDED.risk_score,
       risk_level = EXCLUDED.risk_level,
       factors = EXCLUDED.factors,
       summary = EXCLUDED.summary,
       recommendations = EXCLUDED.recommendations,
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.tenantId,
      params.documentId,
      params.riskScore,
      params.riskLevel,
      JSON.stringify(params.factors),
      params.summary,
      JSON.stringify(params.recommendations),
    ]
  );
}

export async function getRiskSignalsForDocument(params: { tenantId: string; documentId: string }): Promise<RiskSignalRow[]> {
  const result = await pool.query(
    `SELECT id, tenant_id, document_id, type, severity, confidence, weight, explanation, recommendation, metadata, created_at
     FROM risk_signals
     WHERE tenant_id = $1 AND document_id = $2
     ORDER BY created_at ASC`,
    [params.tenantId, params.documentId]
  );
  return result.rows as any;
}

export async function getRiskResultForDocument(params: { tenantId: string; documentId: string }): Promise<RiskResultRow | null> {
  const result = await pool.query(
    `SELECT id, tenant_id, document_id, risk_score, risk_level, factors, summary, recommendations, updated_at
     FROM risk_results
     WHERE tenant_id = $1 AND document_id = $2`,
    [params.tenantId, params.documentId]
  );
  return result.rows[0] ? (result.rows[0] as any) : null;
}

export async function updateDocumentMetadataByTenant(
  documentId: string,
  tenantId: string,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT metadata FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId]
    );
    if (existing.rows.length === 0) return;
    const current = (existing.rows[0] as { metadata: Record<string, unknown> }).metadata || {};
    const merged = { ...current, ...metadataPatch };
    await client.query(
      `UPDATE documents SET metadata = $1 WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify(merged), documentId, tenantId]
    );
  } finally {
    client.release();
  }
}

export async function getVendorMemory(params: { tenantId: string; vendorKey: string }): Promise<
  | {
      count: number;
      meanAmount: number | null;
      m2Amount: number | null;
    }
  | null
> {
  const result = await pool.query(
    `SELECT count, mean_amount, m2_amount FROM vendor_memory WHERE tenant_id = $1 AND vendor_key = $2`,
    [params.tenantId, params.vendorKey]
  );
  const row = result.rows[0] as any;
  if (!row) return null;
  return {
    count: Number(row.count || 0),
    meanAmount: row.mean_amount == null ? null : Number(row.mean_amount),
    m2Amount: row.m2_amount == null ? null : Number(row.m2_amount),
  };
}

export async function insertPatternEvent(params: {
  tenantId: string;
  actorUserId: string;
  documentId?: string | null;
  vendorKey?: string | null;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO pattern_events (tenant_id, user_id, document_id, vendor_key, event_type, severity, title, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.tenantId,
      params.actorUserId,
      params.documentId ?? null,
      params.vendorKey ?? null,
      params.eventType,
      params.severity,
      params.title,
      JSON.stringify(params.details),
    ]
  );
}

export async function upsertDocumentInsights(params: {
  tenantId: string;
  actorUserId: string;
  documentId: string;
  vendorKey?: string | null;
  consistencyScore?: number | null;
  riskScore?: number | null;
  riskReasons: Record<string, unknown>;
  recommendations: string[];
  patterns: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO document_insights (tenant_id, user_id, document_id, vendor_key, consistency_score, risk_score, risk_reasons, recommendations, patterns)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (tenant_id, document_id)
     DO UPDATE SET
       vendor_key = COALESCE(EXCLUDED.vendor_key, document_insights.vendor_key),
       consistency_score = COALESCE(EXCLUDED.consistency_score, document_insights.consistency_score),
       risk_score = COALESCE(EXCLUDED.risk_score, document_insights.risk_score),
       risk_reasons = EXCLUDED.risk_reasons,
       recommendations = EXCLUDED.recommendations,
       patterns = EXCLUDED.patterns,
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.tenantId,
      params.actorUserId,
      params.documentId,
      params.vendorKey ?? null,
      params.consistencyScore ?? null,
      params.riskScore ?? null,
      JSON.stringify(params.riskReasons),
      params.recommendations,
      JSON.stringify(params.patterns),
    ]
  );
}

export async function getDocumentInsights(params: {
  tenantId: string;
  documentId: string;
}): Promise<DocumentInsightRow | null> {
  const result = await pool.query(
    `SELECT id, user_id, document_id, vendor_key, consistency_score, risk_score, risk_reasons, recommendations, patterns, created_at, updated_at
     FROM document_insights
     WHERE tenant_id = $1 AND document_id = $2`,
    [params.tenantId, params.documentId]
  );
  return result.rows[0] ? (result.rows[0] as any) : null;
}

/** Row returned from INSERT/SELECT on documents table */
export interface DocumentRow {
  id: string;
  filename: string;
  uploaded_at: Date;
  tenant_id?: string | null;
  created_by?: string | null;
  risk_level?: string;
  risk_category?: string | null;
  risk_confidence?: number | null;
  version_number?: number;
  extracted_data?: Record<string, unknown> | null;
  risk_score?: number | null;
  summary?: string | null;
  processing_status?: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  processing_progress?: number | null;
  processing_error?: string | null;
  processing_started_at?: Date | null;
  processing_completed_at?: Date | null;
}

export type CustomRuleRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  rule_type: string;
  pattern: string | null;
  keywords: string[] | null;
  prompt: string | null;
  risk_level: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type DocumentInsightRow = {
  id: string;
  user_id: string;
  document_id: string;
  vendor_key: string | null;
  consistency_score: number | null;
  risk_score: number | null;
  risk_reasons: Record<string, unknown>;
  recommendations: string[];
  patterns: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Needed for gen_random_uuid()
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // Create extension if not exists (gracefully handle if pgvector not installed)
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✅ pgvector extension enabled');
    } catch (error: any) {
      if (error.message?.includes('vector.control')) {
        console.warn('⚠️  pgvector extension not installed. Vector search will not work, but app will function normally.');
      } else {
        throw error;
      }
    }

    // Create session table for express-session (if not exists)
    // This matches the schema expected by connect-pg-simple
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS session (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
      `);
      console.log('✅ Session table created/verified');
    } catch (error: any) {
      // Table might already exist or be created by connect-pg-simple
      console.log('Note: Session table check:', error.message);
    }

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        picture TEXT,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        welcome_email_sent BOOLEAN DEFAULT false
      );
    `);

    // Add welcome_email_sent column if it doesn't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;
      `);
    } catch (error: any) {
      console.log('Note: welcome_email_sent column check:', error.message);
    }

    // Create documents table with user_id
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id UUID REFERENCES tenants(id),
        created_by UUID REFERENCES users(id),
        filename VARCHAR(255) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        risk_level VARCHAR(20) DEFAULT 'Normal',
        risk_category VARCHAR(50),
        risk_confidence DECIMAL(5,2),
        extracted_data JSONB DEFAULT '{}'::jsonb,
        risk_score INTEGER,
        summary TEXT,
        processing_status VARCHAR(20) DEFAULT 'COMPLETED',
        processing_progress INTEGER DEFAULT 100,
        processing_error TEXT,
        processing_started_at TIMESTAMP,
        processing_completed_at TIMESTAMP,
        version_number INTEGER DEFAULT 1,
        parent_document_id UUID REFERENCES documents(id),
        metadata JSONB DEFAULT '{}'::jsonb,
        file_data BYTEA,
        file_type VARCHAR(50)
      );
    `);

    // Ensure tenant_id + created_by exist for enterprise workspace model
    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
      `);
    } catch (error: any) {
      console.log('Note: documents tenant_id column check:', error.message);
    }
    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
      `);
    } catch (error: any) {
      console.log('Note: documents created_by column check:', error.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);`);
    } catch (error: any) {
      console.log('Note: documents tenant index check:', error.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);`);
    } catch (error: any) {
      console.log('Note: documents created_by index check:', error.message);
    }

    // Add file storage columns if they don't exist
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS file_data BYTEA;
      `);
    } catch (error: any) {
      console.log('Note: file_data column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS file_type VARCHAR(50);
      `);
    } catch (error: any) {
      console.log('Note: file_type column check:', error.message);
    }

    // Add user_id column if it doesn't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      `);
    } catch (error: any) {
      console.log('Note: user_id column check:', error.message);
    }

    // Add missing columns if they don't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50);
      `);
    } catch (error: any) {
      // Column might already exist, ignore
      console.log('Note: risk_category column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS risk_confidence DECIMAL(5,2);
      `);
    } catch (error: any) {
      console.log('Note: risk_confidence column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
      `);
    } catch (error: any) {
      console.log('Note: version_number column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id);
      `);
    } catch (error: any) {
      console.log('Note: parent_document_id column check:', error.message);
    }

    // Aegis AI Financial Document Intelligence fields
    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}'::jsonb;
      `);
    } catch (error: any) {
      console.log('Note: extracted_data column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS risk_score INTEGER;
      `);
    } catch (error: any) {
      console.log('Note: risk_score column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS summary TEXT;
      `);
    } catch (error: any) {
      console.log('Note: summary column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);
      `);
    } catch (error: any) {
      console.log('Note: vendor_name column check:', error.message);
    }

    // Bulk async processing status fields
    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'COMPLETED';
      `);
    } catch (error: any) {
      console.log('Note: processing_status column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 100;
      `);
    } catch (error: any) {
      console.log('Note: processing_progress column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS processing_error TEXT;
      `);
    } catch (error: any) {
      console.log('Note: processing_error column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;
      `);
    } catch (error: any) {
      console.log('Note: processing_started_at column check:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;
      `);
    } catch (error: any) {
      console.log('Note: processing_completed_at column check:', error.message);
    }

    // Initialize compliance tables (depends on users/documents existing)
    const { initializeAuditLogs } = await import('../compliance/auditLog.js');
    await initializeAuditLogs();

    // Initialize white-label tables (adds tenant_id to documents)
    const { initializeTenants } = await import('../whiteLabel/tenant.js');
    await initializeTenants();

    // Workspace memberships + RBAC roles
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, user_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS tenant_memberships_user_id_idx ON tenant_memberships(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_id_idx ON tenant_memberships(tenant_id);
    `);

    // Folders: tenant-owned (documents are workspace-visible)
    try {
      await client.query(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: folders tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS folders_tenant_id_idx ON folders(tenant_id);`);
    } catch (e: any) {
      console.log('Note: folders tenant index check:', e.message);
    }
    try {
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS folders_tenant_name_uq
         ON folders(tenant_id, name)
         WHERE tenant_id IS NOT NULL AND name IS NOT NULL;`
      );
    } catch (e: any) {
      console.log('Note: folders unique tenant/name index check:', e.message);
    }

    // Ensure tenant_id exists on all business tables for workspace isolation
    try {
      await client.query(`ALTER TABLE custom_rules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: custom_rules tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS custom_rules_tenant_id_idx ON custom_rules(tenant_id);`);
    } catch (e: any) {
      console.log('Note: custom_rules tenant index check:', e.message);
    }

    try {
      await client.query(`ALTER TABLE vendor_memory ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: vendor_memory tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS vendor_memory_tenant_id_idx ON vendor_memory(tenant_id);`);
    } catch (e: any) {
      console.log('Note: vendor_memory tenant index check:', e.message);
    }
    // Tenant-scoped logical uniqueness for vendor memory.
    // Required for safe UPSERTs that scope by tenant_id.
    try {
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS vendor_memory_tenant_vendor_key_uq
         ON vendor_memory(tenant_id, vendor_key)
         WHERE tenant_id IS NOT NULL AND vendor_key IS NOT NULL;`
      );
    } catch (e: any) {
      console.log('Note: vendor_memory unique tenant/vendor_key index check:', e.message);
    }

    try {
      await client.query(`ALTER TABLE pattern_events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: pattern_events tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS pattern_events_tenant_id_idx ON pattern_events(tenant_id);`);
    } catch (e: any) {
      console.log('Note: pattern_events tenant index check:', e.message);
    }
    // Common tenant-scoped query paths
    try {
      await client.query(
        `CREATE INDEX IF NOT EXISTS pattern_events_tenant_document_id_idx
         ON pattern_events(tenant_id, document_id)
         WHERE tenant_id IS NOT NULL AND document_id IS NOT NULL;`
      );
    } catch (e: any) {
      console.log('Note: pattern_events tenant/document index check:', e.message);
    }
    try {
      await client.query(
        `CREATE INDEX IF NOT EXISTS pattern_events_tenant_vendor_key_idx
         ON pattern_events(tenant_id, vendor_key)
         WHERE tenant_id IS NOT NULL AND vendor_key IS NOT NULL;`
      );
    } catch (e: any) {
      console.log('Note: pattern_events tenant/vendor index check:', e.message);
    }

    try {
      await client.query(`ALTER TABLE document_insights ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: document_insights tenant_id column check:', e.message);
    }
    // Tenant-scoped logical uniqueness for document insights.
    // Required for safe UPSERTs that scope by tenant_id.
    try {
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS document_insights_tenant_document_uq
         ON document_insights(tenant_id, document_id)
         WHERE tenant_id IS NOT NULL AND document_id IS NOT NULL;`
      );
    } catch (e: any) {
      console.log('Note: document_insights unique tenant/document index check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS document_insights_tenant_id_idx ON document_insights(tenant_id);`);
    } catch (e: any) {
      console.log('Note: document_insights tenant index check:', e.message);
    }

    // Approvals (single active state per document)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS approvals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          reviewer_id UUID REFERENCES users(id),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e: any) {
      console.log('Note: approvals table check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS approvals_tenant_id_idx ON approvals(tenant_id);`);
    } catch (e: any) {
      console.log('Note: approvals tenant index check:', e.message);
    }
    try {
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS approvals_tenant_document_uq
         ON approvals(tenant_id, document_id)
         WHERE tenant_id IS NOT NULL AND document_id IS NOT NULL;`
      );
    } catch (e: any) {
      console.log('Note: approvals unique tenant/document index check:', e.message);
    }

    // Unified Risk Intelligence tables
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS risk_signals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          type VARCHAR(32) NOT NULL,
          severity VARCHAR(16) NOT NULL,
          confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5,
          weight DECIMAL(10,4) NOT NULL DEFAULT 1,
          explanation TEXT NOT NULL,
          recommendation JSONB NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e: any) {
      console.log('Note: risk_signals table check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS risk_signals_tenant_doc_idx ON risk_signals(tenant_id, document_id);`);
    } catch (e: any) {
      console.log('Note: risk_signals index check:', e.message);
    }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS risk_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          risk_score INTEGER NOT NULL,
          risk_level VARCHAR(32) NOT NULL,
          factors JSONB NOT NULL DEFAULT '{}'::jsonb,
          summary TEXT NOT NULL DEFAULT '',
          recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (tenant_id, document_id)
        );
      `);
    } catch (e: any) {
      console.log('Note: risk_results table check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS risk_results_tenant_doc_idx ON risk_results(tenant_id, document_id);`);
    } catch (e: any) {
      console.log('Note: risk_results index check:', e.message);
    }

    try {
      await client.query(`ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: comparisons tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS comparisons_tenant_id_idx ON comparisons(tenant_id);`);
    } catch (e: any) {
      console.log('Note: comparisons tenant index check:', e.message);
    }

    try {
      await client.query(`ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: audit_reports tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS audit_reports_tenant_id_idx ON audit_reports(tenant_id);`);
    } catch (e: any) {
      console.log('Note: audit_reports tenant index check:', e.message);
    }

    try {
      await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch (e: any) {
      console.log('Note: audit_logs tenant_id column check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);`);
    } catch (e: any) {
      console.log('Note: audit_logs tenant index check:', e.message);
    }

    // Dynamic Rules table for Rule Engine V2
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS dynamic_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          rule_type VARCHAR(32) NOT NULL CHECK (rule_type IN ('threshold', 'required', 'consistency', 'time')),
          config JSONB NOT NULL DEFAULT '{}'::jsonb,
          severity VARCHAR(16) NOT NULL DEFAULT 'medium',
          weight DECIMAL(10,4) NOT NULL DEFAULT 1.0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (tenant_id, name)
        );
      `);
    } catch (e: any) {
      console.log('Note: dynamic_rules table check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS dynamic_rules_tenant_id_idx ON dynamic_rules(tenant_id);`);
    } catch (e: any) {
      console.log('Note: dynamic_rules tenant index check:', e.message);
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS dynamic_rules_active_idx ON dynamic_rules(tenant_id, is_active) WHERE is_active = TRUE;`);
    } catch (e: any) {
      console.log('Note: dynamic_rules active index check:', e.message);
    }

    // Ensure risk_signals has subtype column
    try {
      await client.query(`ALTER TABLE risk_signals ADD COLUMN IF NOT EXISTS subtype VARCHAR(64);`);
    } catch (e: any) {
      console.log('Note: risk_signals subtype column check:', e.message);
    }
    const { initializeFolders } = await import('../api/folders.js');
    await initializeFolders();

    // Initialize feature tables (deadlines, comments, risk clauses, cases, policies, loan_applications)
    const { initializeFeaturesSchema } = await import('./featuresSchema.js');
    await initializeFeaturesSchema();

    // ULI consent log + encrypted document cache (India SME Lending)
    const { initializeConsentLog } = await import('../integrations/uli/consentStore.js');
    await initializeConsentLog();
    const { initializeDocumentStore } = await import('../integrations/uli/documentStore.js');
    await initializeDocumentStore();

    // DPDP tables (rights requests, etc.)
    const { initializeDPDPTables } = await import('../compliance/dpdp.js');
    await initializeDPDPTables();

    // Aegis AI tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS comparisons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        doc_ids UUID[] NOT NULL,
        result_json JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS comparisons_user_id_idx ON comparisons(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_ids UUID[] NOT NULL,
        report TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS audit_reports_user_id_idx ON audit_reports(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        rule_type VARCHAR(40) NOT NULL,
        pattern TEXT,
        keywords TEXT[],
        prompt TEXT,
        risk_level VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS custom_rules_user_id_idx ON custom_rules(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vendor_key TEXT NOT NULL,
        vendor_name TEXT,
        vendor_gstin TEXT,
        count INTEGER NOT NULL DEFAULT 0,
        mean_amount NUMERIC,
        m2_amount NUMERIC,
        last_amount NUMERIC,
        last_seen_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, vendor_key)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS vendor_memory_user_id_idx ON vendor_memory(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pattern_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
        vendor_key TEXT,
        event_type VARCHAR(50) NOT NULL,
        severity VARCHAR(10) NOT NULL,
        title TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pattern_events_user_id_idx ON pattern_events(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pattern_events_document_id_idx ON pattern_events(document_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        vendor_key TEXT,
        consistency_score INTEGER,
        risk_score INTEGER,
        risk_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
        recommendations TEXT[] NOT NULL DEFAULT '{}'::text[],
        patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, document_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_insights_user_id_idx ON document_insights(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_insights_document_id_idx ON document_insights(document_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        notes TEXT,
        reviewer_email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Ensure user_id column exists for existing tables
    try {
      await client.query(`ALTER TABLE approvals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;`);
    } catch (e: any) {
      console.log('Note: approvals user_id column check:', e.message);
    }
    await client.query(`
      CREATE INDEX IF NOT EXISTS approvals_user_id_idx ON approvals(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS approvals_document_id_idx ON approvals(document_id);
    `);

    // Check if pgvector is available
    const hasPgvector = await checkPgvectorAvailable();

    // Create document_chunks table with vector column (or JSONB if pgvector not available)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          embedding ${hasPgvector ? 'vector(1536)' : 'JSONB'},
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // If pgvector is available, migrate existing JSONB embeddings to vector type
      if (hasPgvector) {
        try {
          // Check if embedding column is JSONB (old format)
          const colCheck = await client.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'document_chunks' 
            AND column_name = 'embedding';
          `);

          if (colCheck.rows.length > 0 && (colCheck.rows[0] as Record<string, unknown>).data_type === 'jsonb') {
            console.log('🔄 Migrating embeddings from JSONB to vector type...');
            // Drop old index if it exists (might be on wrong type)
            try {
              await client.query('DROP INDEX IF EXISTS document_chunks_embedding_idx;');
            } catch (e) {
              // Ignore if index doesn't exist
            }

            // Clear old JSONB data and convert column to vector type
            // Old documents will need to be re-uploaded for vector embeddings
            await client.query(`
              ALTER TABLE document_chunks 
              ALTER COLUMN embedding TYPE vector(1536) 
              USING NULL;
            `);
            console.log('✅ Migration complete. Note: Old documents need to be re-uploaded for vector embeddings.');
          }
        } catch (migError: any) {
          // If migration fails, try to alter column type directly
          if (migError.message?.includes('cannot cast') || migError.message?.includes('does not exist')) {
            console.warn('⚠️  Cannot migrate existing JSONB embeddings. Clearing old data and converting column.');
            // Drop old index first
            try {
              await client.query('DROP INDEX IF EXISTS document_chunks_embedding_idx;');
            } catch (e) {
              // Ignore
            }
            // Drop and recreate column
            try {
              await client.query('ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;');
              await client.query('ALTER TABLE document_chunks ADD COLUMN embedding vector(1536);');
            } catch (e) {
              console.warn('⚠️  Column migration failed, but table structure is OK for new inserts');
            }
          } else {
            throw migError;
          }
        }
      }

      // Create index for vector similarity search (only if vector type exists)
      if (hasPgvector) {
        try {
          // Check if index already exists
          const indexExists = await client.query(`
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'document_chunks_embedding_idx'
          `);
          
          if (indexExists.rows.length > 0) {
            console.log('⚠️  Vector index already exists, skipping creation');
          } else {
            await client.query(`
              CREATE INDEX document_chunks_embedding_idx 
              ON document_chunks 
              USING ivfflat (embedding vector_cosine_ops)
              WITH (lists = 100);
            `);
            console.log('✅ Vector index created successfully');
          }
        } catch (error: any) {
          // Index creation fails if pgvector not available - that's OK
          if (error.message?.includes('type "vector" does not exist') ||
              error.message?.includes('access method "ivfflat" does not exist') ||
              error.message?.includes('does not accept data type') ||
              error.message?.includes('duplicate key value violates unique constraint')) {
            console.warn('⚠️  Skipping vector index:', error.message);
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      // If vector type not available, create table without vector column
      if (error.message?.includes('type "vector" does not exist')) {
        console.warn('⚠️  Creating table without vector column (pgvector not available)');
        await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          embedding JSONB,
          chunk_index INTEGER DEFAULT 0,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `);
      } else {
        throw error;
      }
    }

    // Add chunk_index column if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE document_chunks 
        ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;
      `);
    } catch (error: any) {
      console.log('Note: chunk_index column check:', error.message);
    }

    // Create index on document_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx 
      ON document_chunks(document_id);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateDocumentFinancialFields(params: {
  documentId: string;
  userId: string;
  extractedData?: Record<string, unknown> | null;
  riskScore?: number | null;
  summary?: string | null;
}): Promise<void> {
  const { documentId, userId, extractedData, riskScore, summary } = params;
  const client = await pool.connect();
  try {
    // Ensure user owns the document
    const existing = await client.query(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );
    if (existing.rows.length === 0) return;

    await client.query(
      `UPDATE documents
       SET extracted_data = COALESCE($1, extracted_data),
           risk_score = COALESCE($2, risk_score),
           summary = COALESCE($3, summary)
       WHERE id = $4 AND user_id = $5`,
      [
        extractedData == null ? null : JSON.stringify(extractedData),
        riskScore ?? null,
        summary ?? null,
        documentId,
        userId,
      ]
    );
  } finally {
    client.release();
  }
}

export async function insertDocument(
  filename: string,
  userId: string,
  metadata: Record<string, any> = {},
  riskCategory?: string,
  riskConfidence?: number,
  versionNumber: number = 1,
  parentDocumentId?: string,
  fileData?: Buffer,
  fileType?: string
) {
  const client = await pool.connect();
  try {
    // Check which columns exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name IN ('parent_document_id', 'file_data', 'file_type', 'extracted_data', 'risk_score', 'summary')
    `);

    const existingColumns = columnCheck.rows.map((r: any) => r.column_name);
    const hasParentDocId = existingColumns.includes('parent_document_id');
    const hasFileData = existingColumns.includes('file_data');
    const hasFileType = existingColumns.includes('file_type');
    const hasExtractedData = existingColumns.includes('extracted_data');
    const hasRiskScore = existingColumns.includes('risk_score');
    const hasSummary = existingColumns.includes('summary');
    const hasProcessingStatus = existingColumns.includes('processing_status');
    const hasProcessingProgress = existingColumns.includes('processing_progress');
    const hasProcessingError = existingColumns.includes('processing_error');
    const hasProcessingStartedAt = existingColumns.includes('processing_started_at');
    const hasProcessingCompletedAt = existingColumns.includes('processing_completed_at');

    // Build query dynamically based on available columns
    let columns = 'filename, user_id, metadata, risk_category, risk_confidence, version_number';
    let values = '$1, $2, $3, $4, $5, $6';
    let params: any[] = [filename, userId, JSON.stringify(metadata), riskCategory || null, riskConfidence || null, versionNumber];
    let paramIndex = 7;

    if (hasParentDocId && parentDocumentId) {
      columns += ', parent_document_id';
      values += `, $${paramIndex}`;
      params.push(parentDocumentId);
      paramIndex++;
    }

    if (hasFileData && fileData) {
      columns += ', file_data';
      values += `, $${paramIndex}`;
      params.push(fileData);
      paramIndex++;
    }

    if (hasFileType && fileType) {
      columns += ', file_type';
      values += `, $${paramIndex}`;
      params.push(fileType);
      paramIndex++;
    }

    if (hasExtractedData) {
      columns += ', extracted_data';
      values += `, $${paramIndex}`;
      params.push(JSON.stringify({}));
      paramIndex++;
    }

    if (hasRiskScore) {
      columns += ', risk_score';
      values += `, $${paramIndex}`;
      params.push(null);
      paramIndex++;
    }

    if (hasSummary) {
      columns += ', summary';
      values += `, $${paramIndex}`;
      params.push(null);
      paramIndex++;
    }

    const result = await client.query(
      `INSERT INTO documents (${columns}) 
       VALUES (${values}) 
       RETURNING id, filename, uploaded_at, risk_level, risk_category, risk_confidence, version_number, extracted_data, risk_score, summary;`,
      params
    );
    return result.rows[0] as unknown as DocumentRow | undefined;
  } finally {
    client.release();
  }
}

export async function insertDocumentForWorkspace(params: {
  tenantId: string;
  createdBy: string;
  filename: string;
  metadata?: Record<string, any>;
  riskCategory?: string;
  riskConfidence?: number;
  versionNumber?: number;
  parentDocumentId?: string;
  fileData?: Buffer;
  fileType?: string;
}): Promise<DocumentRow | undefined> {
  const {
    tenantId,
    createdBy,
    filename,
    metadata = {},
    riskCategory,
    riskConfidence,
    versionNumber = 1,
    parentDocumentId,
    fileData,
    fileType,
  } = params;

  // Legacy compatibility: user_id is still NOT NULL in many installs.
  // We keep user_id aligned with createdBy, while tenant_id is the primary ownership.
  return await insertDocument(
    filename,
    createdBy,
    { ...metadata, createdBy },
    riskCategory,
    riskConfidence,
    versionNumber,
    parentDocumentId,
    fileData,
    fileType
  );
}

// Cache for pgvector availability check
let pgvectorAvailable: boolean | null = null;

async function checkPgvectorAvailable(): Promise<boolean> {
  if (pgvectorAvailable !== null) {
    return pgvectorAvailable;
  }

  const client = await pool.connect();
  try {
    // Check if vector type exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'vector'
      ) as exists;
    `);
    pgvectorAvailable = !!(result.rows[0] as Record<string, unknown>).exists;
    return pgvectorAvailable;
  } catch (error) {
    pgvectorAvailable = false;
    return false;
  } finally {
    client.release();
  }
}

// Helper function to sanitize text for PostgreSQL UTF-8 encoding
function sanitizeText(text: string): string {
  // Remove null bytes and other invalid UTF-8 sequences
  return text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove other control characters
    .trim();
}

export async function insertChunks(
  documentId: string,
  chunks: Array<{ content: string; embedding: number[]; metadata: Record<string, any> }>
) {
  const client = await pool.connect();
  try {
    const hasPgvector = await checkPgvectorAvailable();
    await client.query('BEGIN');

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Sanitize content to remove invalid UTF-8 sequences
      const sanitizedContent = sanitizeText(chunk.content);

      const chunkIndex = chunk.metadata?.chunkIndex ?? i;

      if (hasPgvector) {
        // Use vector type if pgvector is available
        await client.query(
          `INSERT INTO document_chunks (document_id, content, embedding, metadata, chunk_index) 
           VALUES ($1, $2, $3::vector, $4, $5)`,
          [documentId, sanitizedContent, JSON.stringify(chunk.embedding), JSON.stringify(chunk.metadata), chunkIndex]
        );
      } else {
        // Use JSONB if pgvector is not available
        await client.query(
          `INSERT INTO document_chunks (document_id, content, embedding, metadata, chunk_index) 
           VALUES ($1, $2, $3, $4, $5)`,
          [documentId, sanitizedContent, JSON.stringify(chunk.embedding), JSON.stringify(chunk.metadata), chunkIndex]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.3,
  documentIds?: string[]
) {
  const hasPgvector = await checkPgvectorAvailable();

  // Always try text search first for documents without embeddings, then vector if available
  // This ensures we get results even if embeddings are missing

  // Step 1: Try to get chunks with vector embeddings (if pgvector available)
  if (hasPgvector) {
    try {
      let query = `SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.metadata,
          d.filename,
          d.risk_level,
          d.risk_category,
          1 - (dc.embedding <=> $1::vector) as similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.embedding IS NOT NULL`;

      const params: any[] = [JSON.stringify(queryEmbedding)];
      let paramIndex = 2;

      if (documentIds && documentIds.length > 0) {
        query += ` AND dc.document_id = ANY($${paramIndex})`;
        params.push(documentIds);
        paramIndex++;
      }

      // Lower threshold for better results
      query += ` AND 1 - (dc.embedding <=> $1::vector) > $${paramIndex}`;
      params.push(threshold);
      paramIndex++;

      query += ` ORDER BY dc.embedding <=> $1::vector LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await pool.query(query, params);

      // If we got results from vector search, return them
      if (result.rows.length > 0) {
        console.log(`✅ Found ${result.rows.length} chunks using vector search`);
        return result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.id as string,
            documentId: r.document_id as string,
            content: r.content as string,
            metadata: r.metadata as Record<string, unknown>,
            filename: r.filename as string,
            riskLevel: r.risk_level as string,
            riskCategory: r.risk_category as string,
            similarity: parseFloat(String(r.similarity)),
          };
        });
      }
    } catch (error) {
      console.warn('Vector search failed, falling back to text search:', error);
    }
  }

  // Step 2: Fallback to text search for ALL chunks (not just NULL embeddings)
  // This ensures we always return results if chunks exist
  console.log('⚠️  Using text search fallback (no vector embeddings or vector search failed)');
  return await searchByTextFallback('', limit, documentIds);
}

// Fallback text search for documents without embeddings or when vector search fails
async function searchByTextFallback(
  searchText: string = '',
  limit: number = 5,
  documentIds?: string[]
) {
  // Get ALL chunks (not just NULL embeddings) - this ensures we return results
  // We'll prioritize chunks without embeddings, but include all if needed
  let query = `SELECT 
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      d.filename,
      d.risk_level,
      d.risk_category,
      CASE 
        WHEN dc.embedding IS NULL THEN 0.6
        ELSE 0.4
      END as similarity
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE 1=1`; // Get all chunks, not just NULL embeddings

  const params: any[] = [];
  let paramIndex = 1;

  if (documentIds && documentIds.length > 0) {
    query += ` AND dc.document_id = ANY($${paramIndex})`;
    params.push(documentIds);
    paramIndex++;
  }

  // Order by: NULL embeddings first (higher priority), then by creation date
  query += ` ORDER BY 
      CASE WHEN dc.embedding IS NULL THEN 0 ELSE 1 END,
      dc.created_at DESC 
    LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await pool.query(query, params);

  console.log(`📄 Text fallback found ${result.rows.length} chunks`);

  if (result.rows.length === 0) {
    console.warn('⚠️  No chunks found in database. Document may not have been processed correctly.');
  }

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      documentId: r.document_id as string,
      content: r.content as string,
      metadata: r.metadata as Record<string, unknown>,
      filename: r.filename as string,
      riskLevel: r.risk_level as string,
      riskCategory: r.risk_category as string,
      similarity: parseFloat(String(r.similarity)),
    };
  });
}

export async function updateDocumentRiskLevel(
  documentId: string,
  riskLevel: 'Critical' | 'Warning' | 'Normal',
  riskCategory?: string,
  riskConfidence?: number
) {
  const result = await pool.query(
    `UPDATE documents SET risk_level = $1, risk_category = $3, risk_confidence = $4 WHERE id = $2 RETURNING id, risk_level, risk_category, risk_confidence;`,
    [riskLevel, documentId, riskCategory || null, riskConfidence || null]
  );
  return result.rows[0];
}

export async function updateDocumentRiskLevelByTenant(params: {
  documentId: string;
  tenantId: string;
  riskLevel: 'Critical' | 'Warning' | 'Normal';
  riskCategory?: string;
  riskConfidence?: number;
}): Promise<void> {
  await pool.query(
    `UPDATE documents
     SET risk_level = $1, risk_category = $3, risk_confidence = $4
     WHERE id = $2 AND tenant_id = $5`,
    [
      params.riskLevel,
      params.documentId,
      params.riskCategory || null,
      params.riskConfidence || null,
      params.tenantId,
    ]
  );
}

export async function updateDocumentFilename(
  documentId: string,
  userId: string,
  newFilename: string
) {
  const result = await pool.query(
    `UPDATE documents SET filename = $1 WHERE id = $2 AND user_id = $3 RETURNING id, filename;`,
    [newFilename, documentId, userId]
  );
  return result.rows[0];
}

export async function updateDocumentFilenameByTenant(params: {
  documentId: string;
  tenantId: string;
  newFilename: string;
}): Promise<{ id: string; filename: string } | undefined> {
  const result = await pool.query(
    `UPDATE documents SET filename = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, filename;`,
    [params.newFilename, params.documentId, params.tenantId]
  );
  return result.rows[0] ? (result.rows[0] as any) : undefined;
}

/** Merge metadata patch into document's existing metadata. */
export async function updateDocumentMetadata(
  documentId: string,
  userId: string,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT metadata FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );
    if (existing.rows.length === 0) return;
    const current = (existing.rows[0] as { metadata: Record<string, unknown> }).metadata || {};
    const merged = { ...current, ...metadataPatch };
    await client.query(
      `UPDATE documents SET metadata = $1 WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(merged), documentId, userId]
    );
  } finally {
    client.release();
  }
}

/** Get folder id by name for user, or create folder if it doesn't exist. Returns folder id. */
export async function getOrCreateFolder(userId: string, folderName: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM folders WHERE user_id = $1 AND name = $2`,
      [userId, folderName]
    );
    if (existing.rows.length > 0) {
      return (existing.rows[0] as { id: string }).id;
    }
    const insert = await client.query(
      `INSERT INTO folders (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP RETURNING id`,
      [userId, folderName]
    );
    return insert.rows.length > 0 ? (insert.rows[0] as { id: string }).id : null;
  } finally {
    client.release();
  }
}

/** Set document's folder (or null for root). */
export async function setDocumentFolder(
  documentId: string,
  userId: string,
  folderId: string | null
): Promise<void> {
  await pool.query(
    `UPDATE documents SET folder_id = $1 WHERE id = $2 AND user_id = $3`,
    [folderId, documentId, userId]
  );
}

export async function getDocuments(filters?: {
  riskLevel?: string;
  riskCategory?: string;
  documentIds?: string[];
  tenantId?: string;
  userId?: string;
}) {
  // Check if columns exist first
  const client = await pool.connect();
  try {
    // Get column info
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name IN (
        'risk_category',
        'risk_confidence',
        'version_number',
        'extracted_data',
        'risk_score',
        'summary',
        'processing_status',
        'processing_progress',
        'processing_error',
        'processing_started_at',
        'processing_completed_at',
        'vendor_name'
      )
    `);

    const existingColumns = columnCheck.rows.map((r: any) => r.column_name);
    const hasRiskCategory = existingColumns.includes('risk_category');
    const hasRiskConfidence = existingColumns.includes('risk_confidence');
    const hasVersionNumber = existingColumns.includes('version_number');
    const hasExtractedData = existingColumns.includes('extracted_data');
    const hasRiskScore = existingColumns.includes('risk_score');
    const hasSummary = existingColumns.includes('summary');
    const hasProcessingStatus = existingColumns.includes('processing_status');
    const hasProcessingProgress = existingColumns.includes('processing_progress');
    const hasProcessingError = existingColumns.includes('processing_error');
    const hasProcessingStartedAt = existingColumns.includes('processing_started_at');
    const hasProcessingCompletedAt = existingColumns.includes('processing_completed_at');
    const hasVendorName = existingColumns.includes('vendor_name');

    // Build SELECT query with only existing columns
    let selectColumns = 'id, filename, uploaded_at, risk_level, metadata';
    if (hasRiskCategory) selectColumns += ', risk_category';
    if (hasRiskConfidence) selectColumns += ', risk_confidence';
    if (hasExtractedData) selectColumns += ', extracted_data';
    if (hasRiskScore) selectColumns += ', risk_score';
    if (hasSummary) selectColumns += ', summary';
    if (hasProcessingStatus) selectColumns += ', processing_status';
    if (hasProcessingProgress) selectColumns += ', processing_progress';
    if (hasProcessingError) selectColumns += ', processing_error';
    if (hasProcessingStartedAt) selectColumns += ', processing_started_at';
    if (hasProcessingCompletedAt) selectColumns += ', processing_completed_at';
    if (hasVersionNumber) selectColumns += ', version_number';
    if (hasVendorName) selectColumns += ', vendor_name';
    // Always include folder_id if it exists (it should after folder migration)
    selectColumns += ', folder_id';

    let query = `SELECT ${selectColumns} FROM documents WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.riskLevel) {
      query += ` AND risk_level = $${paramIndex}`;
      params.push(filters.riskLevel);
      paramIndex++;
    }

    if (filters?.riskCategory && hasRiskCategory) {
      query += ` AND risk_category = $${paramIndex}`;
      params.push(filters.riskCategory);
      paramIndex++;
    }

    if (filters?.documentIds && filters.documentIds.length > 0) {
      query += ` AND id = ANY($${paramIndex})`;
      params.push(filters.documentIds);
      paramIndex++;
    }

    if (filters?.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(filters.tenantId);
      paramIndex++;
    } else if (filters?.userId) {
      // Legacy fallback (to be removed once all routes are tenant-scoped)
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    query += ` ORDER BY uploaded_at DESC`;

    const result = await client.query(query, params);

    // Normalize results to always include these fields (null if column doesn't exist)
    return result.rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      uploaded_at: row.uploaded_at,
      risk_level: row.risk_level,
      risk_category: hasRiskCategory ? row.risk_category : null,
      risk_confidence: hasRiskConfidence ? row.risk_confidence : null,
      extracted_data: hasExtractedData ? (row.extracted_data || {}) : null,
      risk_score: hasRiskScore ? row.risk_score : null,
      summary: hasSummary ? row.summary : null,
      processing_status: hasProcessingStatus ? row.processing_status : 'COMPLETED',
      processing_progress: hasProcessingProgress ? row.processing_progress : 100,
      processing_error: hasProcessingError ? row.processing_error : null,
      processing_started_at: hasProcessingStartedAt ? row.processing_started_at : null,
      processing_completed_at: hasProcessingCompletedAt ? row.processing_completed_at : null,
      version_number: hasVersionNumber ? row.version_number : 1,
      folder_id: row.folder_id || null,
      metadata: row.metadata || {},
    }));
  } finally {
    client.release();
  }
}

export async function updateDocumentProcessing(params: {
  documentId: string;
  userId: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  error?: string | null;
}): Promise<void> {
  const { documentId, userId, status, progress, error } = params;
  const progressValue = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : null;

  const startedAt = status === 'PROCESSING' ? new Date() : null;
  const completedAt = status === 'COMPLETED' || status === 'FAILED' ? new Date() : null;

  await pool.query(
    `UPDATE documents
     SET processing_status = $1,
         processing_progress = COALESCE($2, processing_progress),
         processing_error = $3,
         processing_started_at = COALESCE($4, processing_started_at),
         processing_completed_at = COALESCE($5, processing_completed_at)
     WHERE id = $6 AND user_id = $7`,
    [status, progressValue, error || null, startedAt, completedAt, documentId, userId]
  );
}

export async function updateDocumentProcessingByTenant(params: {
  documentId: string;
  tenantId: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  error?: string | null;
}): Promise<void> {
  const { documentId, tenantId, status, progress, error } = params;
  const progressValue = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : null;

  const startedAt = status === 'PROCESSING' ? new Date() : null;
  const completedAt = status === 'COMPLETED' || status === 'FAILED' ? new Date() : null;

  await pool.query(
    `UPDATE documents
     SET processing_status = $1,
         processing_progress = COALESCE($2, processing_progress),
         processing_error = $3,
         processing_started_at = COALESCE($4, processing_started_at),
         processing_completed_at = COALESCE($5, processing_completed_at)
     WHERE id = $6 AND tenant_id = $7`,
    [status, progressValue, error || null, startedAt, completedAt, documentId, tenantId]
  );
}

export async function getDocumentForProcessing(params: {
  documentId: string;
  userId: string;
}): Promise<
  | {
      id: string;
      filename: string;
      uploadedAt: Date | null;
      fileData: Buffer | null;
      fileType: string | null;
    }
  | null
> {
  const { documentId, userId } = params;
  const result = await pool.query(
    `SELECT id, filename, uploaded_at, file_data, file_type
     FROM documents
     WHERE id = $1 AND user_id = $2`,
    [documentId, userId]
  );
  const row = result.rows[0] as any;
  if (!row) return null;
  return {
    id: row.id as string,
    filename: row.filename as string,
    uploadedAt: (row.uploaded_at as Date) ?? null,
    fileData: (row.file_data as Buffer) ?? null,
    fileType: (row.file_type as string) ?? null,
  };
}

export async function getDocument(documentId: string) {
  const result = await pool.query(
    `SELECT id, filename, uploaded_at, risk_level, metadata, extracted_data, risk_score, summary FROM documents WHERE id = $1;`,
    [documentId]
  );
  return result.rows[0] || null;
}

/**
 * Get document content (from chunks)
 */
export async function getDocumentContent(documentId: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT content FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [documentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Combine all chunks
    return result.rows.map((row: any) => row.content).join('\n\n');
  } finally {
    client.release();
  }
}

export async function insertComparison(params: {
  tenantId: string;
  userId: string;
  docIds: string[];
  resultJson: Record<string, unknown>;
}): Promise<{ id: string } | null> {
  const { tenantId, userId, docIds, resultJson } = params;
  const result = await pool.query(
    `INSERT INTO comparisons (tenant_id, user_id, doc_ids, result_json)
     VALUES ($1, $2, $3, $4)
     RETURNING id;`,
    [tenantId, userId, docIds, JSON.stringify(resultJson)]
  );
  return result.rows[0] ? ({ id: (result.rows[0] as any).id as string }) : null;
}

export async function insertAuditReport(params: {
  tenantId: string;
  userId: string;
  documentIds: string[];
  report: string;
}): Promise<{ id: string } | null> {
  const { tenantId, userId, documentIds, report } = params;
  const result = await pool.query(
    `INSERT INTO audit_reports (tenant_id, user_id, document_ids, report)
     VALUES ($1, $2, $3, $4)
     RETURNING id;`,
    [tenantId, userId, documentIds, report]
  );
  return result.rows[0] ? ({ id: (result.rows[0] as any).id as string }) : null;
}
