/**
 * DPDP consent logging - immutable audit trail for every ULI data fetch
 */
import { pool } from '../../db/pgvector.js';
import type { ConsentRecord } from './types.js';

const TABLE = 'uli_consent_log';

export async function initializeConsentLog(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consent_id VARCHAR(255) NOT NULL,
        data_principal_id VARCHAR(100) NOT NULL,
        purpose TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        uli_consent_handle VARCHAR(500),
        data_types TEXT[] NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uli_consent_data_principal ON ${TABLE}(data_principal_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uli_consent_timestamp ON ${TABLE}(timestamp);
    `);
  } finally {
    client.release();
  }
}

export async function logConsent(record: ConsentRecord): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ${TABLE}
       (consent_id, data_principal_id, purpose, timestamp, uli_consent_handle, data_types, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.consentId,
        record.dataPrincipalId,
        record.purpose,
        record.timestamp,
        record.uliConsentHandle ?? null,
        record.dataTypes,
        record.expiresAt ?? null,
      ]
    );
  } finally {
    client.release();
  }
}

export async function getConsentsByDataPrincipal(
  dataPrincipalId: string,
  limit = 50
): Promise<ConsentRecord[]> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT consent_id, data_principal_id, purpose, timestamp, uli_consent_handle, data_types, expires_at
       FROM ${TABLE} WHERE data_principal_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [dataPrincipalId, limit]
    );
    return r.rows.map((row: Record<string, unknown>) => ({
      consentId: row.consent_id as string,
      dataPrincipalId: row.data_principal_id as string,
      purpose: row.purpose as string,
      timestamp: (row.timestamp as Date)?.toISOString?.() ?? String(row.timestamp),
      uliConsentHandle: row.uli_consent_handle as string | undefined,
      dataTypes: (row.data_types as string[]) ?? [],
      expiresAt: row.expires_at != null ? (row.expires_at as Date)?.toISOString?.() : undefined,
    }));
  } finally {
    client.release();
  }
}
