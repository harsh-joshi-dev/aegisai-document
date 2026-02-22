/**
 * Prompt for classifying document type for smart folder organization.
 */
export function createDocumentTypePrompt(text: string, filename: string): string {
  return `You are a financial document classifier. Classify this document into exactly ONE type and identify its financial year.

DOCUMENT TYPES (return the exact string):
- Bank: Bank statements, account summaries, passbook entries, cancelled cheques
- GST: GST returns (GSTR-1/2A/3B/9), GST invoices, GST registration certificates
- Legal: Legal notices, court orders, agreements, contracts, NDA, legal letters, MOUs
- Salary: Salary slips, pay stubs, Form 16, CTC breakdowns, compensation letters
- Investment: Mutual fund statements, demat holdings, FD receipts, insurance policies, PPF
- Bills: Utility bills, rent receipts, purchase invoices (non-GST), expense receipts
- Notices: Tax notices, demand notices, show-cause notices, reminder letters
- Invoices: Sales/purchase invoices, proforma invoices, commercial invoices, credit/debit notes
- Tax Documents: ITR, Form 26AS, TDS certificates, tax assessment orders, advance tax receipts
- KYC: PAN card, Aadhaar, passport, voter ID, company registration, GSTIN certificate
- General: Cannot determine or mixed/general document

CLASSIFICATION TIPS:
- Look at header/title, column names, and key terms first
- Check for standard form numbers (GSTR, ITR, Form 16, etc.)
- For invoices vs bills: invoices have GST/tax components; bills may not
- Financial year: Look for "FY", assessment year, period covered, or dates in the document

Filename: ${filename}

Document content (first 4000 characters):
${text.substring(0, 4000)}

Respond with ONLY valid JSON:
{ "documentType": "one of the types above", "financialYear": "FY 2024-25 or null", "confidence": 0.0-1.0 }`;
}
