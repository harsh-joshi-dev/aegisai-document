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

Requirements:
- 4-7 bullet points
- Mention key extracted fields (date, amount, GSTIN, vendor) when available
- If something is missing/ambiguous, mention it as a risk to verify
- Output plain text only

Filename: ${filename}
Extracted JSON:
${JSON.stringify(extracted)}

Document content (first 3500 chars):
${text.slice(0, 3500)}
`;

  const resp = await llm.invoke(prompt);
  const content = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);
  return content.trim();
}
