/**
 * Encrypted temporary storage for ULI-fetched documents.
 * Auto-deletion after 90 days (DPDP purpose completion).
 */
import crypto from 'crypto';
import { pool } from '../../db/pgvector.js';
import type { ULIFetchResult } from './types.js';

const TABLE = 'uli_document_cache';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const DEFAULT_RETENTION_DAYS = 90;

function getEncryptionKey(): Buffer {
  const key = process.env.ULI_STORAGE_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'aegis-uli-default-key-change-in-prod';
  return crypto.scryptSync(key, 'uli-salt', KEY_LENGTH);
}

function encrypt(plain: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = (cipher as crypto.CipherGCM).getAuthTag();
  return {
    encrypted: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );
  (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(tag, 'base64'));
  return decipher.update(Buffer.from(encrypted, 'base64')) + decipher.final('utf8');
}

export async function initializeDocumentStore(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consent_id VARCHAR(255) NOT NULL,
        data_principal_id VARCHAR(100) NOT NULL,
        payload_encrypted TEXT NOT NULL,
        payload_iv VARCHAR(100) NOT NULL,
        payload_tag VARCHAR(100) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uli_cache_consent ON ${TABLE}(consent_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uli_cache_expires ON ${TABLE}(expires_at);
    `);
  } finally {
    client.release();
  }
}

export async function storeDocuments(
  consentId: string,
  dataPrincipalId: string,
  result: ULIFetchResult,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);
  const plain = JSON.stringify(result);
  const { encrypted, iv, tag } = encrypt(plain);
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO ${TABLE} (consent_id, data_principal_id, payload_encrypted, payload_iv, payload_tag, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [consentId, dataPrincipalId, encrypted, iv, tag, expiresAt]
    );
    return (r.rows[0] as Record<string, string>).id;
  } finally {
    client.release();
  }
}

export async function getStoredDocuments(
  consentId: string
): Promise<ULIFetchResult | null> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT payload_encrypted, payload_iv, payload_tag, expires_at FROM ${TABLE}
       WHERE consent_id = $1 AND expires_at > NOW() LIMIT 1`,
      [consentId]
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0] as Record<string, string>;
    const decrypted = decrypt(row.payload_encrypted, row.payload_iv, row.payload_tag);
    return JSON.parse(decrypted) as ULIFetchResult;
  } finally {
    client.release();
  }
}

/** Delete expired rows (DPDP auto-deletion). Call from cron. */
export async function deleteExpiredDocuments(): Promise<number> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `DELETE FROM ${TABLE} WHERE expires_at <= NOW()`
    );
    return (r as { rowCount?: number }).rowCount ?? 0;
  } finally {
    client.release();
  }
}

/** Delete by consent ID (e.g. on data principal erasure request). */
export async function deleteByConsentId(consentId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const r = await client.query(`DELETE FROM ${TABLE} WHERE consent_id = $1`, [consentId]);
    return (r as { rowCount?: number }).rowCount ?? 0;
  } finally {
    client.release();
  }
}
