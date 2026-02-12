/**
 * ULI (Unified Lending Interface) Connector
 * India SME Lending - GSTN, Income Tax, UIDAI, Account Aggregator
 * DPDP: consent logging, encrypted temp storage, 90-day auto-deletion
 */
import { checkRateLimit, recordCall } from './rateLimiter.js';
import { logConsent } from './consentStore.js';
import { storeDocuments, getStoredDocuments } from './documentStore.js';
import { fetchULIDocuments } from './fetcher.js';
import type { ULIFetchRequest, ULIFetchResult, ConsentRecord } from './types.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function nowIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().replace('Z', '+05:30');
}

/**
 * Request documents from ULI with consent logging and rate limit.
 * Stores result in encrypted cache with 90-day expiry.
 */
export async function requestULIDocuments(
  request: ULIFetchRequest,
  retentionDays: number = 90
): Promise<ULIFetchResult> {
  if (!checkRateLimit()) {
    throw new Error('ULI rate limit exceeded: max 100 API calls per minute');
  }
  recordCall();

  const consentRecord: ConsentRecord = {
    consentId: request.consentId,
    dataPrincipalId: request.dataPrincipalId,
    purpose: request.purpose,
    timestamp: nowIST(),
    dataTypes: request.types,
  };
  await logConsent(consentRecord);

  const result = await fetchULIDocuments(request);
  if (result.success || (result.documents && Object.keys(result.documents).length > 0)) {
    await storeDocuments(
      request.consentId,
      request.dataPrincipalId,
      result,
      retentionDays
    );
  }
  return result;
}

export { getStoredDocuments };
export { logConsent, getConsentsByDataPrincipal } from './consentStore.js';
export { deleteExpiredDocuments, deleteByConsentId } from './documentStore.js';
export { getRemainingCalls, checkRateLimit } from './rateLimiter.js';
export { getAccessToken } from './auth.js';
export * from './types.js';
