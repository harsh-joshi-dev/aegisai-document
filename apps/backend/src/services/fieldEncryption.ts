/**
 * Field-Level Encryption for DPDP Compliance
 * Encrypts sensitive PII fields: GSTIN, PAN, Aadhaar, bank account numbers.
 * Uses AES-256-GCM with a per-tenant key derived from a master key.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:v1:';

function getMasterKey(): Buffer {
  const envKey = process.env.FIELD_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'aegis-default-encryption-key-change-me';
  return createHash('sha256').update(envKey).digest();
}

function deriveTenantKey(tenantId: string): Buffer {
  const master = getMasterKey();
  return createHash('sha256').update(Buffer.concat([master, Buffer.from(tenantId)])).digest();
}

export function encryptField(value: string, tenantId: string): string {
  if (!value || value.startsWith(ENCRYPTED_PREFIX)) return value;

  const key = deriveTenantKey(tenantId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, Buffer.from(encrypted, 'base64')]).toString('base64');
  return `${ENCRYPTED_PREFIX}${payload}`;
}

export function decryptField(encrypted: string, tenantId: string): string {
  if (!encrypted || !encrypted.startsWith(ENCRYPTED_PREFIX)) return encrypted;

  try {
    const key = deriveTenantKey(tenantId);
    const payload = Buffer.from(encrypted.slice(ENCRYPTED_PREFIX.length), 'base64');

    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = payload.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch {
    return '[DECRYPTION_FAILED]';
  }
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function maskField(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

const PII_FIELDS = ['vendorGstin', 'customerGstin', 'vendor_gstin', 'customer_gstin', 'panNumber', 'pan', 'aadhaar', 'aadhaarNumber', 'bankAccountLast4'];

export function encryptPiiInObject(obj: Record<string, any>, tenantId: string): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };

  for (const field of PII_FIELDS) {
    if (result[field] && typeof result[field] === 'string' && !isEncrypted(result[field])) {
      result[field] = encryptField(result[field], tenantId);
    }
  }

  return result;
}

export function decryptPiiInObject(obj: Record<string, any>, tenantId: string): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };

  for (const field of PII_FIELDS) {
    if (result[field] && typeof result[field] === 'string' && isEncrypted(result[field])) {
      result[field] = decryptField(result[field], tenantId);
    }
  }

  return result;
}

export function maskPiiInObject(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };

  for (const field of PII_FIELDS) {
    if (result[field] && typeof result[field] === 'string') {
      const val = isEncrypted(result[field]) ? result[field] : result[field];
      result[`${field}_masked`] = maskField(val.replace(ENCRYPTED_PREFIX, '').slice(0, 15));
    }
  }

  return result;
}
