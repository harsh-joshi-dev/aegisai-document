import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { ExtractedData } from './extractorAgent.js';
import { RiskAnalysis } from './riskAnalystAgent.js';
import { ComplianceAnalysis } from './complianceAgent.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
    });
  }
  return llm;
}

export interface CounterProposal {
  section: string;
  originalText: string;
  proposedText: string;
  reason: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  riskAddressed?: string;
}

export interface NegotiationStrategy {
  counterProposals: CounterProposal[];
  talkingPoints: string[];
  redLines: string[]; // Non-negotiable items
  concessions: string[]; // Items we can concede
  marketBenchmarks: Array<{
    term: string;
    marketStandard: string;
    currentDocument: string;
    recommendation: string;
  }>;
  overallStrategy: string;
}

export async function generateNegotiationStrategy(
  documentContent: string,
  extractedData: ExtractedData,
  riskAnalysis: RiskAnalysis,
  complianceAnalysis: ComplianceAnalysis,
  filename: string,
  userParty?: string // Which party the user represents
): Promise<NegotiationStrategy> {
  const llm = getLLM();
  
  const prompt = `You are an expert negotiation agent. Generate a comprehensive negotiation strategy and counter-proposals.

Document: ${filename}
User Party: ${userParty || 'Not specified'}

Extracted Data:
- Parties: ${extractedData.parties.join(', ')}
- Key Terms: ${extractedData.terms.length} terms
- Obligations: ${extractedData.obligations.length} obligations
- Dates: ${extractedData.dates.length} dates

Risk Analysis:
- Risk Score: ${riskAnalysis.riskScore}/100
- Current Risks: ${riskAnalysis.currentRisks.length}
- Predicted Risks: ${riskAnalysis.predictedRisks.length}

Compliance Analysis:
- Overall Score: ${complianceAnalysis.overallComplianceScore}/100
- Critical Issues: ${complianceAnalysis.criticalIssues.length}

Document Content (first 4000 characters):
${documentContent.substring(0, 4000)}

Generate:

1. **Counter-Proposals**: Specific text changes to propose
   - Section reference
   - Original text
   - Proposed replacement
   - Reason for change
   - Priority level
   - Risk addressed (if any)

2. **Talking Points**: Key points to raise in negotiation

3. **Red Lines**: Non-negotiable items that must be changed

4. **Concessions**: Items we can accept as-is

5. **Market Benchmarks**: Compare terms to industry standards

6. **Overall Strategy**: High-level negotiation approach

Return ONLY a valid JSON object:
{
  "counterProposals": [
    {
      "section": "Section name or clause",
      "originalText": "Current text",
      "proposedText": "Proposed replacement",
      "reason": "Why this change is needed",
      "priority": "Critical | High | Medium | Low",
      "riskAddressed": "Which risk this addresses (if any)"
    }
  ],
  "talkingPoints": ["Point 1", "Point 2"],
  "redLines": ["Must change 1", "Must change 2"],
  "concessions": ["Can accept 1"],
  "marketBenchmarks": [
    {
      "term": "Term name",
      "marketStandard": "What's typical",
      "currentDocument": "What document says",
      "recommendation": "What to propose"
    }
  ],
  "overallStrategy": "High-level strategy description"
}

Return only JSON, no markdown.`;

  try {
    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const strategy = JSON.parse(cleaned) as NegotiationStrategy;

    return strategy;
  } catch (error) {
    console.error('Negotiation agent error:', error);
    return {
      counterProposals: [],
      talkingPoints: ['Manual negotiation review recommended'],
      redLines: [],
      concessions: [],
      marketBenchmarks: [],
      overallStrategy: 'Unable to generate strategy. Manual review required.',
    };
  }
}
