/**
 * Due Diligence Report Agent - India SME Lending
 * Generates report in format acceptable to NBFC credit committees
 */
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import type { RiskFlag } from '../rules/indiaConsistencyRules.js';

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

export interface DueDiligenceReport {
  summary: string;
  consistencyScore: number;
  riskFlags: RiskFlag[];
  sections: Array<{
    title: string;
    content: string;
  }>;
  recommendation: 'Approve' | 'Review' | 'Decline';
  nbfcNotes: string;
}

export async function generateDueDiligenceReport(
  documentsSummary: string,
  consistencyScore: number,
  riskFlags: RiskFlag[]
): Promise<DueDiligenceReport> {
  const llm = getLLM();
  const prompt = `You are an expert credit committee report writer for Indian NBFCs. Generate a concise Due Diligence Report based on the following.

Documents summary:
${documentsSummary}

Consistency score (0-100): ${consistencyScore}
Risk flags found: ${riskFlags.length}
${riskFlags.map((f) => `- [${f.severity}] ${f.code}: ${f.message}`).join('\n')}

Produce a report with:
1. Executive summary (2-3 sentences)
2. Section "Revenue & Tax Consistency" (GST vs ITR)
3. Section "Employment & Bank Behaviour"
4. Section "Address & Identity Verification"
5. Recommendation: one of Approve / Review / Decline with one-line reason
6. NBFC committee notes (bullet points, max 5)

Return ONLY valid JSON in this format:
{
  "summary": "string",
  "consistencyScore": number,
  "riskFlags": [],
  "sections": [{"title": "string", "content": "string"}],
  "recommendation": "Approve" | "Review" | "Decline",
  "nbfcNotes": "string"
}`;

  const response = await llm.invoke(prompt);
  const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let parsed: DueDiligenceReport;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      summary: `Consistency score ${consistencyScore}. ${riskFlags.length} risk flag(s) identified.`,
      consistencyScore,
      riskFlags,
      sections: [
        { title: 'Revenue & Tax Consistency', content: 'See risk flags.' },
        { title: 'Recommendation', content: consistencyScore >= 70 ? 'Review' : 'Decline' },
      ],
      recommendation: consistencyScore >= 80 ? 'Approve' : consistencyScore >= 50 ? 'Review' : 'Decline',
      nbfcNotes: 'Automated report. Verify critical flags manually.',
    };
  }
  parsed.consistencyScore = consistencyScore;
  parsed.riskFlags = riskFlags;
  return parsed;
}
