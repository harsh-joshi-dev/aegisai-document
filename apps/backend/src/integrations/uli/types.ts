/**
 * ULI (Unified Lending Interface) integration types
 * India SME Lending - GSTN, Income Tax, UIDAI, Account Aggregator
 */

export type ULIEnvironment = 'sandbox' | 'production';

export interface ULIClientConfig {
  environment: ULIEnvironment;
  clientId: string;
  clientSecret: string;
  /** Base URL for ULI API (sandbox or production) */
  baseUrl: string;
  /** Path to client certificate (PEM) for mTLS */
  clientCertPath?: string;
  /** Path to client key (PEM) */
  clientKeyPath?: string;
  /** OAuth token URL */
  tokenUrl: string;
}

/** DPDP consent record - immutable audit trail */
export interface ConsentRecord {
  consentId: string;
  dataPrincipalId: string; // Masked Aadhaar e.g. XXXX-XXXX-1234
  purpose: string;
  timestamp: string; // ISO 8601, IST
  uliConsentHandle?: string;
  dataTypes: string[]; // e.g. ['GSTR-1', 'ITR-V', 'bank_statement']
  expiresAt?: string;
}

/** GST document (GSTR-1, GSTR-3B) */
export interface GSTDocument {
  type: 'GSTR-1' | 'GSTR-3B';
  period: string;
  taxableValue?: number;
  taxAmount?: number;
  rawJson?: Record<string, unknown>;
  fetchedAt: string;
}

/** ITR / Form 16 */
export interface ITRDocument {
  type: 'ITR-V' | 'Form 16';
  assessmentYear: string;
  grossReceipts?: number;
  rawData?: Record<string, unknown>;
  fetchedAt: string;
}

/** Bank statement (AA framework) */
export interface BankStatement {
  accountId: string;
  fromDate: string;
  toDate: string;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
  }>;
  fetchedAt: string;
}

/** eAadhaar XML derived data (masked) */
export interface AadhaarData {
  maskedUid: string;
  addressLine1?: string;
  state?: string;
  pincode?: string;
  fetchedAt: string;
}

export type ULIDocumentType = 'gst' | 'itr' | 'bank' | 'aadhaar';

export interface ULIFetchRequest {
  consentId: string;
  dataPrincipalId: string;
  purpose: string;
  types: ULIDocumentType[];
  /** AA consent handle for bank data */
  aaConsentHandle?: string;
}

export interface ULIFetchResult {
  success: boolean;
  consentId: string;
  documents: {
    gstReturns?: GSTDocument[];
    itrForms?: ITRDocument[];
    bankStatements?: BankStatement[];
    aadhaarXml?: AadhaarData;
  };
  errors?: string[];
}
