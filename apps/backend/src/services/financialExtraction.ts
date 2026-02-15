export type FinancialDocumentType = 'INVOICE' | 'BANK_STATEMENT' | 'GST' | 'UNKNOWN';

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
  const t = `${filename}\n${text}`.toLowerCase();
  if (t.includes('invoice') || t.includes('tax invoice')) return 'INVOICE';
  if (t.includes('bank statement') || t.includes('account statement') || t.includes('statement period')) return 'BANK_STATEMENT';
  if (t.includes('gstr') || t.includes('gst return') || t.includes('gstin') && t.includes('gstr-')) return 'GST';
  return 'UNKNOWN';
}

function guessVendorName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Heuristic: first non-empty line that looks like an organization name (not 'Invoice', 'Tax Invoice', etc.)
  for (const line of lines.slice(0, 30)) {
    const lower = line.toLowerCase();
    if (lower.includes('invoice') || lower.includes('tax invoice')) continue;
    if (lower.startsWith('bill to') || lower.startsWith('ship to') || lower.startsWith('date')) continue;
    if (line.length < 4) continue;
    if (line.match(/\b\d{2}[A-Z]{5}\d{4}/)) continue;
    if (line.match(/^[0-9\s\-.,]+$/)) continue;
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

export function extractFinancialData(params: { text: string; filename: string }): ExtractedFinancialData {
  const { text, filename } = params;

  const gstins = Array.from(new Set(text.match(GSTIN_REGEX) ?? []));
  const allDates = extractDates(text);

  const documentType = detectDocType(text, filename);

  const invoiceNumber = extractInvoiceNumber(text);
  const invoiceDate = extractLabelledDate(text, 'invoice\\s*date') ?? extractLabelledDate(text, '\\bdate\\b') ?? (allDates[0] ?? null);
  const dueDate = extractLabelledDate(text, 'due\\s*date');

  const totalAmount = extractBestAmount(text);

  // When multiple GSTINs present, we can't reliably label vendor/customer without more context.
  // We store first as vendorGstin heuristically.
  const vendorGstin = gstins[0] ?? null;
  const customerGstin = gstins.length > 1 ? gstins[1] : null;

  return {
    documentType,
    invoiceNumber,
    invoiceDate,
    dueDate,
    vendorName: guessVendorName(text),
    vendorGstin,
    customerGstin,
    totalAmount,
    currency: text.includes('₹') || /\bINR\b/i.test(text) ? 'INR' : null,
    rawMatches: {
      gstins,
      dates: allDates,
      amountCandidatesDetected: totalAmount != null,
    },
  };
}
