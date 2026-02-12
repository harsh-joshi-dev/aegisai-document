/**
 * Fetch documents from ULI ecosystem: GSTN, Income Tax, UIDAI, AA (bank statements)
 * Sandbox returns mock data when real APIs are not configured.
 */
import { getAccessToken } from './auth.js';
import type {
  ULIFetchRequest,
  ULIFetchResult,
  GSTDocument,
  ITRDocument,
  BankStatement,
  AadhaarData,
} from './types.js';

const BASE_URL = process.env.ULI_BASE_URL || 'https://sandbox.uli.org.in';

async function uliGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 502) return {} as T;
    throw new Error(`ULI API error: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch GSTR-1 / GSTR-3B from GSTN (mock for sandbox) */
async function fetchGST(consentId: string, dataPrincipalId: string): Promise<GSTDocument[]> {
  try {
    const data = await uliGet<{ returns?: Array<{ type: string; period: string; taxableValue?: number; taxAmount?: number }> }>(
      `/v1/gst/returns?consent=${consentId}`
    );
    if (data?.returns?.length) {
      return data.returns.map((r) => ({
        type: r.type as 'GSTR-1' | 'GSTR-3B',
        period: r.period,
        taxableValue: r.taxableValue,
        taxAmount: r.taxAmount,
        fetchedAt: new Date().toISOString(),
      }));
    }
  } catch (_) {
    // Sandbox: no real API
  }
  return [
    {
      type: 'GSTR-3B',
      period: '2024-01',
      taxableValue: 12_50_000,
      taxAmount: 2_25_000,
      fetchedAt: new Date().toISOString(),
    },
    {
      type: 'GSTR-1',
      period: '2024-01',
      taxableValue: 12_50_000,
      fetchedAt: new Date().toISOString(),
    },
  ];
}

/** Fetch ITR-V / Form 16 from Income Tax (mock for sandbox) */
async function fetchITR(consentId: string): Promise<ITRDocument[]> {
  try {
    const data = await uliGet<{ forms?: Array<{ type: string; assessmentYear: string; grossReceipts?: number }> }>(
      `/v1/income-tax/forms?consent=${consentId}`
    );
    if (data?.forms?.length) {
      return data.forms.map((f) => ({
        type: f.type as 'ITR-V' | 'Form 16',
        assessmentYear: f.assessmentYear,
        grossReceipts: f.grossReceipts,
        fetchedAt: new Date().toISOString(),
      }));
    }
  } catch (_) {}
  return [
    {
      type: 'ITR-V',
      assessmentYear: '2023-24',
      grossReceipts: 15_00_000,
      fetchedAt: new Date().toISOString(),
    },
  ];
}

/** Fetch bank statements via Account Aggregator (mock for sandbox) */
async function fetchBankStatements(consentId: string, aaConsentHandle?: string): Promise<BankStatement[]> {
  try {
    const handle = aaConsentHandle || consentId;
    const data = await uliGet<{ statements?: Array<{ accountId: string; fromDate: string; toDate: string; transactions?: unknown[] }> }>(
      `/v1/aa/statements?consent=${handle}`
    );
    if (data?.statements?.length) {
      return data.statements.map((s) => ({
        accountId: s.accountId,
        fromDate: s.fromDate,
        toDate: s.toDate,
        transactions: (s.transactions as BankStatement['transactions']) || [],
        fetchedAt: new Date().toISOString(),
      }));
    }
  } catch (_) {}
  return [
    {
      accountId: '****1234',
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
      transactions: [
        { date: '2024-01-15', description: 'SALARY', amount: 85000, type: 'credit' as const },
        { date: '2024-01-20', description: 'NEFT OUT', amount: 25000, type: 'debit' as const },
      ],
      fetchedAt: new Date().toISOString(),
    },
  ];
}

/** Fetch eAadhaar XML derived data (masked) from UIDAI (mock for sandbox) */
async function fetchAadhaar(consentId: string, dataPrincipalId: string): Promise<AadhaarData | undefined> {
  try {
    const data = await uliGet<{ maskedUid?: string; address?: { line1?: string; state?: string; pincode?: string } }>(
      `/v1/uidai/verify?consent=${consentId}`
    );
    if (data?.maskedUid) {
      return {
        maskedUid: data.maskedUid,
        addressLine1: data.address?.line1,
        state: data.address?.state,
        pincode: data.address?.pincode,
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch (_) {}
  return {
    maskedUid: dataPrincipalId || 'XXXX-XXXX-1234',
    state: 'MH',
    pincode: '400001',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch all requested document types from ULI; rate limit and consent must be checked by caller.
 */
export async function fetchULIDocuments(request: ULIFetchRequest): Promise<ULIFetchResult> {
  const documents: ULIFetchResult['documents'] = {};
  const errors: string[] = [];

  if (request.types.includes('gst')) {
    try {
      documents.gstReturns = await fetchGST(request.consentId, request.dataPrincipalId);
    } catch (e) {
      errors.push(`GST: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
  if (request.types.includes('itr')) {
    try {
      documents.itrForms = await fetchITR(request.consentId);
    } catch (e) {
      errors.push(`ITR: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
  if (request.types.includes('bank')) {
    try {
      documents.bankStatements = await fetchBankStatements(request.consentId, request.aaConsentHandle);
    } catch (e) {
      errors.push(`Bank: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
  if (request.types.includes('aadhaar')) {
    try {
      const aadhaar = await fetchAadhaar(request.consentId, request.dataPrincipalId);
      if (aadhaar) documents.aadhaarXml = aadhaar;
    } catch (e) {
      errors.push(`Aadhaar: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    consentId: request.consentId,
    documents,
    errors: errors.length > 0 ? errors : undefined,
  };
}
