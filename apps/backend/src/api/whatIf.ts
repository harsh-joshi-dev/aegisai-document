import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

const whatIfRequestSchema = z.object({
  documentId: z.string().uuid(),
  scenario: z.string().min(1, 'Scenario is required'),
  language: z.string().default('en'),
});

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.3, // Lower temperature for more consistent analysis
    });
  }
  
  return llm;
}

interface ConsequenceAnalysis {
  scenario: string;
  consequences: Array<{
    category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Reputational';
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    likelihood: 'Unlikely' | 'Possible' | 'Likely' | 'Very Likely';
    impact: string;
  }>;
  overallSeverity: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendations: string[];
  riskScore: number; // 0-100
}

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = whatIfRequestSchema.parse(req.body);

    // Get document
    const documents = await getDocuments({
      documentIds: [validated.documentId],
      userId: authReq.user!.id,
    });

    if (documents.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document does not exist or you do not have access to it.',
      });
    }

    const document = documents[0];
    
    // Get document content
    const content = await getDocumentContent(validated.documentId);
    if (!content) {
      return res.status(404).json({
        error: 'Document content not found',
        message: 'The document exists but has no content available.',
      });
    }

    // Generate consequence analysis using LLM
    const llm = getLLM();

    const prompt = `You are a legal and compliance expert analyzing potential consequences of a scenario.

Document Information:
- Filename: ${document.filename}
- Risk Level: ${document.risk_level}
- Risk Category: ${document.risk_category || 'Not specified'}

Document Content (first 3000 characters):
${content.substring(0, 3000)}

Scenario to Analyze:
"${validated.scenario}"

Analyze the potential consequences if this scenario occurs. Consider:
1. Legal consequences (contractual obligations, liabilities, penalties)
2. Financial consequences (costs, fees, losses, penalties)
3. Compliance consequences (regulatory violations, reporting requirements)
4. Operational consequences (process disruptions, workflow impacts)
5. Reputational consequences (public perception, trust, relationships)

If the scenario is about IGNORING a notice or DELAYING payment: also include consequences that show penalty growth over time, legal risk timeline (short/medium/long term), and worst-case outcome (e.g. prosecution, attachment, interest compounding). Be specific about amounts and dates where possible.

For each consequence, provide:
- Category (Legal, Financial, Compliance, Operational, or Reputational)
- Description (clear, specific explanation)
- Severity (Low, Medium, High, or Critical)
- Likelihood (Unlikely, Possible, Likely, or Very Likely)
- Impact (specific details about what would happen)

Also provide:
- Overall severity assessment
- Risk score (0-100, where 0 is no risk and 100 is catastrophic)
- Actionable recommendations to mitigate or avoid these consequences

Return ONLY a valid JSON object in this exact format:
{
  "scenario": "${validated.scenario}",
  "consequences": [
    {
      "category": "Legal",
      "description": "...",
      "severity": "High",
      "likelihood": "Likely",
      "impact": "..."
    }
  ],
  "overallSeverity": "High",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "riskScore": 75
}

Do not include any markdown formatting, code blocks, or additional text. Only the JSON object.`;

    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    // Parse JSON response
    let analysis: ConsequenceAnalysis;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
      
      // Validate structure
      if (!analysis.consequences || !Array.isArray(analysis.consequences)) {
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      // Fallback analysis
      analysis = {
        scenario: validated.scenario,
        consequences: [{
          category: 'Legal',
          description: 'Unable to generate detailed analysis. Please review the document manually and consult with a legal expert.',
          severity: 'Medium',
          likelihood: 'Possible',
          impact: 'Unknown - requires manual review',
        }],
        overallSeverity: 'Medium',
        recommendations: [
          'Review the document carefully',
          'Consult with a legal expert',
          'Consider the potential risks before proceeding',
        ],
        riskScore: 50,
      };
    }

    res.json({
      success: true,
      analysis,
      language: validated.language,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('What If analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze scenario',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
