export type FinancialDocumentType = 'INVOICE' | 'BANK_STATEMENT' | 'GST' | 'PNL' | 'BALANCE_SHEET' | 'ITR' | 'CANCELLED_CHEQUE' | 'PAN_CARD' | 'KYC_FORM' | 'CERTIFICATE' | 'AUDITOR_REPORT' | 'UNKNOWN';

export interface ExtractedFinancialData {
  documentType: FinancialDocumentType;
  invoiceNumber?: string | null;
  invoiceDate?: string | null; // ISO date if possible
  dueDate?: string | null; // ISO date if possible
  vendorName?: string | null;
  vendorGstin?: string | null;
  customerGstin?: string | null;
  totalAmount?: number | null;
  taxableAmount?: number | null;
  gstAmount?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  cgstRate?: number | null;
  sgstRate?: number | null;
  igstRate?: number | null;
  hsnCode?: string | null;
  placeOfSupply?: string | null;
  currency?: string | null;
  bankAccountLast4?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  rawMatches?: Record<string, unknown>;
}

const GSTIN_REGEX = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}\b/g;

const MONEY_REGEXES: RegExp[] = [
  /\b(?:INR|Rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\b/gi,
  /\b([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\s*(?:INR|Rs\.?|₹)\b/gi,
];

const DATE_REGEXES: RegExp[] = [
  /\b(\d{4})[-/](\d{2})[-/](\d{2})\b/g, // yyyy-mm-dd
  /\b(\d{2})[-/](\d{2})[-/](\d{4})\b/g, // dd-mm-yyyy
  /\b(\d{2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*(\d{4})\b/gi,
];

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIsoDateParts(y: number, m: number, d: number): string | null {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function monthNameToNumber(mon: string): number | null {
  const m = mon.toLowerCase();
  const map: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  return map[m] ?? null;
}

function extractDates(text: string): string[] {
  const out: string[] = [];

  for (const re of DATE_REGEXES) {
    const matches = text.matchAll(re);
    for (const m of matches) {
      if (re === DATE_REGEXES[0]) {
        const iso = toIsoDateParts(Number(m[1]), Number(m[2]), Number(m[3]));
        if (iso) out.push(iso);
        continue;
      }
      if (re === DATE_REGEXES[1]) {
        const iso = toIsoDateParts(Number(m[3]), Number(m[2]), Number(m[1]));
        if (iso) out.push(iso);
        continue;
      }

      // dd Mon yyyy
      const mon = monthNameToNumber(String(m[2]));
      const iso = mon ? toIsoDateParts(Number(m[3]), mon, Number(m[1])) : null;
      if (iso) out.push(iso);
    }
  }

  return Array.from(new Set(out));
}

function detectDocType(text: string, filename: string): FinancialDocumentType {
  const fl = filename.toLowerCase();
  const t = `${fl}\n${text.slice(0, 2000)}`.toLowerCase();

  if ((fl.includes('cancel') && fl.includes('cheque')) || t.includes('cancelled cheque')) return 'CANCELLED_CHEQUE';
  if ((fl.includes('pan') && fl.includes('card')) || t.includes('permanent account number') || (fl.includes('pan') && !fl.includes('company'))) return 'PAN_CARD';
  if (fl.includes('kyc') || (fl.includes('vendor') && fl.includes('form'))) return 'KYC_FORM';
  if ((fl.includes('certificate') && fl.includes('incorp')) || t.includes('certificate of incorporation')) return 'CERTIFICATE';
  if (fl.includes('auditor') || fl.includes('independent') || (fl.includes('audit') && fl.includes('report'))) return 'AUDITOR_REPORT';
  if (fl.includes('itr') || t.includes('income tax return') || (t.includes('assessment year') && t.includes('acknowledgement'))) return 'ITR';
  if (fl.includes('profit') || fl.includes('p&l') || fl.includes('pnl') || t.includes('statement of profit and loss')) return 'PNL';
  if ((fl.includes('balance') && fl.includes('sheet')) || t.includes('balance sheet as at')) return 'BALANCE_SHEET';
  if (t.includes('invoice') || t.includes('tax invoice')) return 'INVOICE';
  if (t.includes('bank statement') || t.includes('account statement') || t.includes('statement period')) return 'BANK_STATEMENT';
  if (fl.includes('gst') && (fl.includes('registration') || fl.includes('certif'))) return 'CERTIFICATE';
  if (t.includes('gstr') || t.includes('gst return')) return 'GST';
  return 'UNKNOWN';
}

function guessVendorName(text: string, docType: FinancialDocumentType): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip lines that are document-type labels, not entity names
  const skipPatterns = [
    /^cancelled?\s*cheque/i, /^pan\s*card/i, /^aadhaa?r/i, /^kyc/i,
    /^invoice/i, /^tax\s*invoice/i, /^bank\s*statement/i, /^statement\s*of/i,
    /^profit\s*(and|&)\s*loss/i, /^balance\s*sheet/i, /^certificate/i,
    /^income\s*tax/i, /^form\s*\d/i, /^auditor/i, /^independent/i,
    /^bill\s*to/i, /^ship\s*to/i, /^date/i, /^assessment/i,
    /^government\s*of/i, /^ministry/i, /^department/i,
  ];

  for (const line of lines.slice(0, 30)) {
    if (line.length < 4 || line.length > 120) continue;
    if (line.match(/\b\d{2}[A-Z]{5}\d{4}/)) continue;
    if (line.match(/^[0-9\s\-.,]+$/)) continue;
    if (skipPatterns.some(p => p.test(line))) continue;
    // For non-financial docs, look specifically for company/entity names
    if (docType === 'CANCELLED_CHEQUE' || docType === 'PAN_CARD' || docType === 'KYC_FORM' || docType === 'CERTIFICATE') {
      // Look for lines containing "Ltd", "Pvt", "Corp", "Inc", or proper names
      if (/(?:ltd|pvt|corp|inc|llp|limited|company|enterprises|industries|solutions)/i.test(line)) {
        return line.slice(0, 120);
      }
      continue;
    }
    return line.slice(0, 120);
  }

  return null;
}

function extractInvoiceNumber(text: string): string | null {
  const re = /(invoice\s*(no\.|number|#)\s*[:\-]?\s*)([A-Z0-9\-\/]{3,40})/i;
  const m = text.match(re);
  return m?.[3]?.trim() ?? null;
}

function extractLabelledDate(text: string, label: string): string | null {
  const re = new RegExp(`${label}\\s*[:\\-]?\\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4}|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}\\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s*[0-9]{4})`, 'i');
  const m = text.match(re);
  if (!m?.[1]) return null;
  const candidates = extractDates(m[1]);
  return candidates[0] ?? null;
}

function extractBestAmount(text: string): number | null {
  const candidates: number[] = [];
  for (const re of MONEY_REGEXES) {
    const matches = text.matchAll(re);
    for (const m of matches) {
      const n = parseMoney(String(m[1] ?? ''));
      if (n != null) candidates.push(n);
    }
  }
  if (candidates.length === 0) return null;

  // Prefer the largest number (often Total)
  candidates.sort((a, b) => b - a);
  return candidates[0];
}

function extractGstBreakdown(text: string): {
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  taxableAmount: number | null;
  hsnCode: string | null;
  placeOfSupply: string | null;
} {
  const result = {
    cgstAmount: null as number | null,
    sgstAmount: null as number | null,
    igstAmount: null as number | null,
    cgstRate: null as number | null,
    sgstRate: null as number | null,
    igstRate: null as number | null,
    taxableAmount: null as number | null,
    hsnCode: null as string | null,
    placeOfSupply: null as string | null,
  };

  // CGST amount
  const cgstAmtMatch = text.match(/CGST\s*(?:Amount)?[:\s@]*(?:₹|Rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i);
  if (cgstAmtMatch) result.cgstAmount = parseMoney(cgstAmtMatch[1]) ?? null;

  // SGST amount
  const sgstAmtMatch = text.match(/SGST\s*(?:Amount)?[:\s@]*(?:₹|Rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i);
  if (sgstAmtMatch) result.sgstAmount = parseMoney(sgstAmtMatch[1]) ?? null;

  // IGST amount
  const igstAmtMatch = text.match(/IGST\s*(?:Amount)?[:\s@]*(?:₹|Rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i);
  if (igstAmtMatch) result.igstAmount = parseMoney(igstAmtMatch[1]) ?? null;

  // GST rates
  const cgstRateMatch = text.match(/CGST\s*(?:Rate)?[:\s@]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (cgstRateMatch) result.cgstRate = parseFloat(cgstRateMatch[1]);

  const sgstRateMatch = text.match(/SGST\s*(?:Rate)?[:\s@]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (sgstRateMatch) result.sgstRate = parseFloat(sgstRateMatch[1]);

  const igstRateMatch = text.match(/IGST\s*(?:Rate)?[:\s@]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (igstRateMatch) result.igstRate = parseFloat(igstRateMatch[1]);

  // Taxable amount / value
  const taxableMatch = text.match(/(?:taxable\s*(?:value|amount)|sub\s*total|net\s*amount)\s*[:\-]?\s*(?:₹|Rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i);
  if (taxableMatch) result.taxableAmount = parseMoney(taxableMatch[1]) ?? null;

  // HSN code
  const hsnMatch = text.match(/HSN\s*(?:code|no\.?|#)?[:\s]*([0-9]{4,8})/i);
  if (hsnMatch) result.hsnCode = hsnMatch[1];

  // Place of supply
  const posMatch = text.match(/place\s*of\s*supply\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,30})/i);
  if (posMatch) result.placeOfSupply = posMatch[1].trim();

  return result;
}

export function extractFinancialData(params: { text: string; filename: string }): ExtractedFinancialData {
  const { text, filename } = params;

  const gstins = Array.from(new Set(text.match(GSTIN_REGEX) ?? []));
  const allDates = extractDates(text);

  const documentType = detectDocType(text, filename);

  const invoiceNumber = extractInvoiceNumber(text);
  const invoiceDate = extractLabelledDate(text, 'invoice\\s*date') ?? extractLabelledDate(text, '\\bdate\\b') ?? (allDates[0] ?? null);
  const dueDate = extractLabelledDate(text, 'due\\s*date');

  const totalAmount = extractBestAmount(text);

  const vendorGstin = gstins[0] ?? null;
  const customerGstin = gstins.length > 1 ? gstins[1] : null;

  const isNonFinancial = ['CANCELLED_CHEQUE', 'PAN_CARD', 'KYC_FORM', 'CERTIFICATE', 'AUDITOR_REPORT'].includes(documentType);

  const gstBreakdown = isNonFinancial ? null : extractGstBreakdown(text);

  return {
    documentType,
    invoiceNumber: isNonFinancial ? null : invoiceNumber,
    invoiceDate: isNonFinancial ? null : invoiceDate,
    dueDate: isNonFinancial ? null : dueDate,
    vendorName: guessVendorName(text, documentType),
    vendorGstin: isNonFinancial ? null : vendorGstin,
    customerGstin: isNonFinancial ? null : customerGstin,
    totalAmount: isNonFinancial ? null : totalAmount,
    taxableAmount: gstBreakdown?.taxableAmount ?? null,
    gstAmount: gstBreakdown
      ? ((gstBreakdown.cgstAmount || 0) + (gstBreakdown.sgstAmount || 0) + (gstBreakdown.igstAmount || 0)) || null
      : null,
    cgstAmount: gstBreakdown?.cgstAmount ?? null,
    sgstAmount: gstBreakdown?.sgstAmount ?? null,
    igstAmount: gstBreakdown?.igstAmount ?? null,
    cgstRate: gstBreakdown?.cgstRate ?? null,
    sgstRate: gstBreakdown?.sgstRate ?? null,
    igstRate: gstBreakdown?.igstRate ?? null,
    hsnCode: gstBreakdown?.hsnCode ?? null,
    placeOfSupply: gstBreakdown?.placeOfSupply ?? null,
    currency: isNonFinancial ? null : (text.includes('₹') || /\bINR\b/i.test(text) ? 'INR' : null),
    rawMatches: {
      gstins: isNonFinancial ? [] : gstins,
      dates: isNonFinancial ? [] : allDates,
      amountCandidatesDetected: isNonFinancial ? false : totalAmount != null,
    },
  };
}
