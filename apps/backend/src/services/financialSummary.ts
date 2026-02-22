import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import type { ExtractedFinancialData } from './financialExtraction.js';

export async function generateFinancialSummary(params: {
  extracted: ExtractedFinancialData;
  text: string;
  filename: string;
}): Promise<string> {
  const { extracted, text, filename } = params;

  // Deterministic fallback when OpenAI isn't configured.
  if (!config.openai.apiKey) {
    const lines: string[] = [];
    lines.push(`Document: ${filename}`);
    lines.push(`Type: ${extracted.documentType}`);
    if (extracted.vendorName) lines.push(`Vendor: ${extracted.vendorName}`);
    if (extracted.invoiceNumber) lines.push(`Invoice No: ${extracted.invoiceNumber}`);
    if (extracted.invoiceDate) lines.push(`Invoice Date: ${extracted.invoiceDate}`);
    if (extracted.totalAmount != null) lines.push(`Total: ${extracted.totalAmount}${extracted.currency ? ` ${extracted.currency}` : ''}`);
    return lines.join('\n');
  }

  const llm = new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0.2,
  });

  const prompt = `You are Aegis AI, a Financial Document Intelligence assistant.
Create a concise summary for a finance professional.

CRITICAL: First identify the DOCUMENT TYPE from the filename and content. Different documents require different fields:

FINANCIAL DOCUMENTS (Invoice, P&L, Balance Sheet, Bank Statement, GST Return, ITR):
- Mention: dates, amounts, totals, GSTIN, vendor name, financial year
- Flag missing financial fields as risks

IDENTITY / VERIFICATION DOCUMENTS (Cancelled Cheque, PAN Card, Aadhaar, KYC Form):
- Cancelled Cheque: mention bank name, branch, account number, IFSC, cheque number. Do NOT flag missing amount/date/GSTIN — cheques don't have these.
- PAN Card: mention PAN number, name, type. Do NOT flag missing GSTIN/amount/date.
- KYC Form: mention vendor name, contact details, address. Do NOT flag missing invoice fields.

LEGAL / REGISTRATION DOCUMENTS (Certificate of Incorporation, GST Certificate, Auditor Report):
- Mention: entity name, registration number, date of registration, authority
- Do NOT flag missing invoice number, amount, due date, GSTIN

RULE: Only flag a field as "missing/risk" if it is EXPECTED for that document type. Never flag irrelevant fields.

Requirements:
- 4-7 bullet points
- Identify the document type first
- Mention fields relevant to that specific document type
- Output plain text only

Filename: ${filename}
Extracted JSON:
${JSON.stringify(extracted)}

Document content (first 5000 chars):
${text.slice(0, 5000)}
`;

  const resp = await llm.invoke(prompt);
  const content = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);
  return content.trim();
}
