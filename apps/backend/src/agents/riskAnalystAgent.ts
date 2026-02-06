import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { ExtractedData } from './extractorAgent.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
    });
  }
  return llm;
}

export interface RiskAnalysis {
  currentRisks: Array<{
    category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Reputational';
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    impact: string;
    likelihood: number; // 0-100
  }>;
  predictedRisks: Array<{
    timeframe: string;
    risk: string;
    probability: number; // 0-100
    mitigation: string;
  }>;
  riskScore: number; // 0-100
  recommendations: string[];
}

export async function analyzeRisks(
  documentContent: string,
  extractedData: ExtractedData,
  filename: string
): Promise<RiskAnalysis> {
  const llm = getLLM();
  
  const prompt = `You are an expert risk analyst agent. Analyze this document for current and future risks.

Document: ${filename}
Extracted Data:
- Terms: ${extractedData.terms.length} found
- Dates: ${extractedData.dates.length} found
- Obligations: ${extractedData.obligations.length} found
- Parties: ${extractedData.parties.join(', ')}
- Amounts: ${extractedData.amounts.length} found

Document Content (first 4000 characters):
${documentContent.substring(0, 4000)}

Analyze:

1. **Current Risks**: Identify immediate risks in the document
   - Category (Legal, Financial, Compliance, Operational, Reputational)
   - Severity (Critical, High, Medium, Low)
   - Description and impact
   - Likelihood (0-100%)

2. **Predicted Risks**: Forecast potential future problems
   - Timeframe (e.g., "Within 30 days", "After 6 months")
   - Risk description
   - Probability (0-100%)
   - Mitigation strategy

3. **Overall Risk Score**: 0-100 (0 = no risk, 100 = catastrophic)

4. **Recommendations**: Actionable steps to mitigate risks

Return ONLY a valid JSON object:
{
  "currentRisks": [
    {
      "category": "Legal",
      "severity": "High",
      "description": "...",
      "impact": "...",
      "likelihood": 75
    }
  ],
  "predictedRisks": [
    {
      "timeframe": "Within 30 days",
      "risk": "...",
      "probability": 60,
      "mitigation": "..."
    }
  ],
  "riskScore": 65,
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Return only JSON, no markdown.`;

  try {
    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned) as RiskAnalysis;

    // Ensure riskScore is 0-100
    analysis.riskScore = Math.max(0, Math.min(100, analysis.riskScore || 50));

    return analysis;
  } catch (error) {
    console.error('Risk analyst agent error:', error);
    return {
      currentRisks: [],
      predictedRisks: [],
      riskScore: 50,
      recommendations: ['Manual review recommended'],
    };
  }
}
