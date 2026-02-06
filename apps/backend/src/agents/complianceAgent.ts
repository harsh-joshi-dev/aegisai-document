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
      temperature: 0.1,
    });
  }
  return llm;
}

// Common jurisdictions to check
const JURISDICTIONS = [
  'United States (Federal)', 'California', 'New York', 'Texas', 'Delaware',
  'United Kingdom', 'European Union (GDPR)', 'Germany', 'France', 'Spain',
  'Canada', 'Australia', 'India', 'Singapore', 'Hong Kong', 'Japan',
  'China', 'Brazil', 'Mexico', 'South Africa', 'UAE', 'Saudi Arabia',
  // Add more as needed
];

export interface ComplianceCheck {
  jurisdiction: string;
  status: 'Compliant' | 'Non-Compliant' | 'Requires Review' | 'Not Applicable';
  issues: string[];
  requirements: string[];
  score: number; // 0-100
}

export interface ComplianceAnalysis {
  checks: ComplianceCheck[];
  overallComplianceScore: number; // 0-100
  criticalIssues: string[];
  recommendations: string[];
}

export async function checkCompliance(
  documentContent: string,
  extractedData: ExtractedData,
  filename: string,
  jurisdictions?: string[]
): Promise<ComplianceAnalysis> {
  const llm = getLLM();
  const jurisdictionsToCheck = jurisdictions || JURISDICTIONS.slice(0, 10); // Limit to 10 for performance
  
  const prompt = `You are an expert compliance agent. Check this document against multiple jurisdictions.

Document: ${filename}
Jurisdictions to check: ${jurisdictionsToCheck.join(', ')}

Extracted Data Summary:
- Parties: ${extractedData.parties.join(', ')}
- Key Terms: ${extractedData.terms.length} terms found
- Obligations: ${extractedData.obligations.length} obligations found

Document Content (first 4000 characters):
${documentContent.substring(0, 4000)}

For each jurisdiction, check:
1. Data privacy requirements (GDPR, CCPA, etc.)
2. Contract law compliance
3. Consumer protection laws
4. Industry-specific regulations
5. Cross-border transaction rules

Return ONLY a valid JSON object:
{
  "checks": [
    {
      "jurisdiction": "United States (Federal)",
      "status": "Compliant | Non-Compliant | Requires Review | Not Applicable",
      "issues": ["Issue 1", "Issue 2"],
      "requirements": ["Requirement 1", "Requirement 2"],
      "score": 85
    }
  ],
  "overallComplianceScore": 75,
  "criticalIssues": ["Critical issue 1"],
  "recommendations": ["Recommendation 1"]
}

Return only JSON, no markdown.`;

  try {
    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned) as ComplianceAnalysis;

    // Ensure scores are 0-100
    analysis.overallComplianceScore = Math.max(0, Math.min(100, analysis.overallComplianceScore || 50));
    analysis.checks = analysis.checks.map(check => ({
      ...check,
      score: Math.max(0, Math.min(100, check.score || 50)),
    }));

    return analysis;
  } catch (error) {
    console.error('Compliance agent error:', error);
    return {
      checks: jurisdictionsToCheck.map(j => ({
        jurisdiction: j,
        status: 'Requires Review' as const,
        issues: ['Unable to analyze - manual review recommended'],
        requirements: [],
        score: 50,
      })),
      overallComplianceScore: 50,
      criticalIssues: ['Compliance analysis unavailable'],
      recommendations: ['Manual compliance review recommended'],
    };
  }
}
