/**
 * DPDP (Digital Personal Data Protection Act) India compliance
 * Consent logging, auto-deletion, data principal rights, cross-border transfer blocker
 */
import { pool } from '../db/pgvector.js';
import { deleteExpiredDocuments, deleteByConsentId } from '../integrations/uli/documentStore.js';
import { getConsentsByDataPrincipal } from '../integrations/uli/consentStore.js';

/** Approved countries for data transfer (India + approved jurisdictions). Block US/EU by default. */
const APPROVED_COUNTRIES = (process.env.DPDP_APPROVED_COUNTRIES || 'IN')
  .toUpperCase()
  .split(',')
  .map((c) => c.trim());

export interface DataPrincipalRightsRequest {
  dataPrincipalId: string;
  right: 'access' | 'correction' | 'erasure';
  details?: Record<string, unknown>;
}

export interface DataPrincipalRightsResponse {
  requestId: string;
  dataPrincipalId: string;
  right: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: string;
  dueBy: string; // 30-day SLA
  message?: string;
}

const SLA_DAYS = 30;

export async function initializeDPDPTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS dpdp_rights_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_principal_id VARCHAR(100) NOT NULL,
        right_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        due_by TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        response_message TEXT
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dpdp_rights_data_principal ON dpdp_rights_requests(data_principal_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dpdp_rights_status ON dpdp_rights_requests(status);
    `);
  } finally {
    client.release();
  }
}

/** Create a data principal rights request (30-day SLA). */
export async function createRightsRequest(
  dataPrincipalId: string,
  right: 'access' | 'correction' | 'erasure',
  details?: Record<string, unknown>
): Promise<DataPrincipalRightsResponse> {
  const dueBy = new Date();
  dueBy.setDate(dueBy.getDate() + SLA_DAYS);
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO dpdp_rights_requests (data_principal_id, right_type, status, details, due_by)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING id, data_principal_id, right_type, status, created_at, due_by`,
      [dataPrincipalId, right, JSON.stringify(details ?? {}), dueBy]
    );
    const row = r.rows[0] as Record<string, unknown>;
    return {
      requestId: row.id as string,
      dataPrincipalId: row.data_principal_id as string,
      right: row.right_type as string,
      status: 'pending',
      createdAt: (row.created_at as Date)?.toISOString?.() ?? String(row.created_at),
      dueBy: (row.due_by as Date)?.toISOString?.() ?? String(row.due_by),
      message: 'Request logged. Resolution within 30 days per DPDP.',
    };
  } finally {
    client.release();
  }
}

/** Get status of rights requests for a data principal. */
export async function getRightsRequests(
  dataPrincipalId: string,
  limit = 20
): Promise<DataPrincipalRightsResponse[]> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, data_principal_id, right_type, status, created_at, due_by, completed_at, response_message
       FROM dpdp_rights_requests WHERE data_principal_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [dataPrincipalId, limit]
    );
    return r.rows.map((row: Record<string, unknown>) => ({
      requestId: row.id as string,
      dataPrincipalId: row.data_principal_id as string,
      right: row.right_type as string,
      status: row.status as DataPrincipalRightsResponse['status'],
      createdAt: (row.created_at as Date)?.toISOString?.() ?? String(row.created_at),
      dueBy: (row.due_by as Date)?.toISOString?.() ?? String(row.due_by),
      message: row.response_message as string | undefined,
    }));
  } finally {
    client.release();
  }
}

/** Run auto-deletion: ULI document cache + optional loan application data past retention. */
export async function runDPDPAutoDeletion(retentionDays: number = 90): Promise<{ uliDeleted: number; loansDeleted: number }> {
  const uliDeleted = await deleteExpiredDocuments();
  const client = await pool.connect();
  let loansDeleted = 0;
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const r = await client.query(
      `DELETE FROM loan_applications WHERE deletion_due_date <= $1`,
      [cutoff]
    );
    loansDeleted = (r as { rowCount?: number }).rowCount ?? 0;
  } finally {
    client.release();
  }
  return { uliDeleted, loansDeleted };
}

/** Check if transfer to country is allowed (block US/EU by default). */
export function isTransferAllowed(destinationCountryCode: string): boolean {
  const code = destinationCountryCode.toUpperCase().trim();
  return APPROVED_COUNTRIES.includes(code);
}

/** Get approved countries list. */
export function getApprovedCountries(): string[] {
  return [...APPROVED_COUNTRIES];
}

/** Execute erasure: delete ULI cache by consent and mark request completed. */
export async function executeErasure(
  requestId: string,
  consentIds: string[]
): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const cid of consentIds) {
    deleted += await deleteByConsentId(cid);
  }
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE dpdp_rights_requests SET status = 'completed', completed_at = NOW(), response_message = $2 WHERE id = $1`,
      [requestId, `Erasure completed. Deleted ${deleted} cached record(s).`]
    );
  } finally {
    client.release();
  }
  return { deleted };
}

/** Fulfill access request: return consent log + any stored data references (no PII in response). */
export async function fulfillAccessRequest(dataPrincipalId: string): Promise<{
  consents: Awaited<ReturnType<typeof getConsentsByDataPrincipal>>;
  message: string;
}> {
  const consents = await getConsentsByDataPrincipal(dataPrincipalId, 100);
  return {
    consents,
    message: 'Data principal access summary. Full export available on request.',
  };
}
