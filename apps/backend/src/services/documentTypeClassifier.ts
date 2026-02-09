/**
 * Classifies document type for smart folder organization.
 * Types: Bank, GST, Legal, Salary, Investment, Bills, Notices, Invoices, Tax Documents, General.
 */
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { createDocumentTypePrompt } from '../prompts/documentType.prompt.js';

export const SMART_FOLDER_NAMES: Record<string, string> = {
  Bank: 'Bank Statements',
  GST: 'GST Returns',
  Legal: 'Legal Notices',
  Salary: 'Salary',
  Investment: 'Investment',
  Bills: 'Invoices',
  Notices: 'Notices',
  Invoices: 'Invoices',
  'Tax Documents': 'Tax Documents',
  General: 'General',
};

export type DocumentType = keyof typeof SMART_FOLDER_NAMES;

export interface DocumentTypeResult {
  documentType: DocumentType;
  folderName: string;
  financialYear: string | null;
  confidence: number;
}

/** Indian FY: April–March. e.g. 15 May 2024 → FY 2024-25 */
export function getFinancialYearFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  if (month >= 4) return `FY ${year}-${String(year + 1).slice(-2)}`;
  return `FY ${year - 1}-${String(year).slice(-2)}`;
}

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai?.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
    });
  }
  return llm;
}

/**
 * Classify document type from text and filename. Returns folder name and optional FY.
 */
export async function classifyDocumentType(
  text: string,
  filename: string
): Promise<DocumentTypeResult> {
  const fallback: DocumentTypeResult = {
    documentType: 'General',
    folderName: SMART_FOLDER_NAMES.General,
    financialYear: null,
    confidence: 0.5,
  };

  if (!text || text.trim().length < 20) {
    const lower = filename.toLowerCase();
    if (lower.includes('bank') || lower.includes('statement')) return { ...fallback, documentType: 'Bank', folderName: SMART_FOLDER_NAMES.Bank };
    if (lower.includes('gst')) return { ...fallback, documentType: 'GST', folderName: SMART_FOLDER_NAMES.GST };
    if (lower.includes('salary') || lower.includes('payslip')) return { ...fallback, documentType: 'Salary', folderName: SMART_FOLDER_NAMES.Salary };
    if (lower.includes('invoice')) return { ...fallback, documentType: 'Invoices', folderName: SMART_FOLDER_NAMES.Invoices };
    return fallback;
  }

  try {
    const prompt = createDocumentTypePrompt(text, filename);
    const response = await getLLM().invoke(prompt);
    const raw = typeof response.content === 'string' ? response.content.trim() : JSON.stringify(response.content);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const data = JSON.parse(cleaned) as { documentType?: string; financialYear?: string | null; confidence?: number };

    const docType = (data.documentType && SMART_FOLDER_NAMES[data.documentType as DocumentType])
      ? (data.documentType as DocumentType)
      : 'General';
    const folderName = SMART_FOLDER_NAMES[docType];
    const financialYear =
      typeof data.financialYear === 'string' && data.financialYear.trim()
        ? data.financialYear.trim()
        : null;
    const confidence = typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0.7;

    return {
      documentType: docType,
      folderName,
      financialYear,
      confidence,
    };
  } catch (e) {
    console.warn('Document type classification failed:', e);
    return fallback;
  }
}
