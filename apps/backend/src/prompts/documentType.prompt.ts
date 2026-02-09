/**
 * Prompt for classifying document type for smart folder organization.
 */
export function createDocumentTypePrompt(text: string, filename: string): string {
  return `You are a document classifier. Classify this document into exactly ONE of the following types based on content and filename.

Document types (return only this exact string):
- Bank: Bank statements, account summaries, passbook entries
- GST: GST returns, GST invoices, GST registration, tax returns (GST)
- Legal: Legal notices, court orders, agreements, contracts, NDA, legal letters
- Salary: Salary slips, pay stubs, Form 16, compensation letters
- Investment: Mutual fund statements, demat, shares, fixed deposit, insurance policy, PPF, LIC
- Bills: Utility bills, rent receipts, purchase invoices (non-GST), general bills
- Notices: Tax notices, demand notices, reminder letters, official notices (non-legal)
- Invoices: Sales/purchase invoices, commercial invoices
- Tax Documents: Income tax returns, ITR, tax assessment, TDS certificates (non-GST)
- General: Cannot determine or mixed/general document

Filename: ${filename}

Document content (first 2500 characters):
${text.substring(0, 2500)}

Respond with ONLY a JSON object, no markdown, no explanation:
{ "documentType": "one of the types above", "financialYear": "FY 2024-25 or null if not determinable", "confidence": 0.0-1.0 }`;
}
