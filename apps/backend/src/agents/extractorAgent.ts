import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
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

export interface ExtractedData {
  terms: Array<{
    type: string;
    value: string;
    context: string;
  }>;
  dates: Array<{
    description: string;
    date: string;
    importance: 'Critical' | 'High' | 'Medium' | 'Low';
  }>;
  obligations: Array<{
    party: string;
    obligation: string;
    deadline?: string;
    penalty?: string;
  }>;
  parties: string[];
  amounts: Array<{
    description: string;
    amount: string;
    currency?: string;
    frequency?: string;
  }>;
}

export async function extractDocumentData(documentContent: string, filename: string): Promise<ExtractedData> {
  const llm = getLLM();
  
  const prompt = `You are an expert document extractor agent. Extract all critical information from this document.

Document: ${filename}
Content (first 5000 characters):
${documentContent.substring(0, 5000)}

Extract and structure the following information:

1. **Terms**: All contractual terms, conditions, clauses (with context)
2. **Dates**: All dates mentioned (deadlines, expiry, milestones) with importance level
3. **Obligations**: All obligations for each party with deadlines and penalties
4. **Parties**: All parties involved in the document
5. **Amounts**: All monetary amounts, payments, fees with currency and frequency

Return ONLY a valid JSON object in this exact format:
{
  "terms": [
    {
      "type": "Term type (e.g., Payment, Termination, Liability)",
      "value": "The actual term text",
      "context": "Where it appears in the document"
    }
  ],
  "dates": [
    {
      "description": "What this date represents",
      "date": "YYYY-MM-DD or relative date",
      "importance": "Critical | High | Medium | Low"
    }
  ],
  "obligations": [
    {
      "party": "Party name",
      "obligation": "What they must do",
      "deadline": "When (if specified)",
      "penalty": "Consequence if not met (if specified)"
    }
  ],
  "parties": ["Party 1", "Party 2"],
  "amounts": [
    {
      "description": "What this amount is for",
      "amount": "Amount value",
      "currency": "USD, EUR, etc.",
      "frequency": "One-time, Monthly, Annual, etc."
    }
  ]
}

Be thorough and extract everything. Return only the JSON, no markdown.`;

  try {
    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleaned) as ExtractedData;

    return extracted;
  } catch (error) {
    console.error('Extractor agent error:', error);
    // Return minimal structure on error
    return {
      terms: [],
      dates: [],
      obligations: [],
      parties: [],
      amounts: [],
    };
  }
}
