import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

const trustScoreRequestSchema = z.object({
  documentId: z.string().uuid(),
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
      temperature: 0.2, // Very low temperature for consistent scoring
    });
  }
  
  return llm;
}

interface TrustScoreAnalysis {
  trustScore: number; // 0-100
  status: 'Safe' | 'Needs Review' | 'Dangerous';
  factors: {
    riskLevel: {
      score: number;
      weight: number;
      details: string;
    };
    missingClauses: {
      score: number;
      weight: number;
      details: string[];
    };
    unusualPatterns: {
      score: number;
      weight: number;
      details: string[];
    };
    ambiguousLanguage: {
      score: number;
      weight: number;
      details: string[];
    };
    expiryOrOutdated: {
      score: number;
      weight: number;
      details: string;
    };
  };
  summary: string;
  recommendations: string[];
}

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = trustScoreRequestSchema.parse(req.body);

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

    // Generate trust score analysis using LLM
    const llm = getLLM();

    const prompt = `You are a document trustworthiness expert. Analyze this document and calculate a comprehensive Trust Score (0-100).

Document Information:
- Filename: ${document.filename}
- Risk Level: ${document.risk_level}
- Risk Category: ${document.risk_category || 'Not specified'}
- Risk Confidence: ${document.risk_confidence || 'N/A'}%

Document Content (first 4000 characters):
${content.substring(0, 4000)}

Analyze the document across these factors:

1. **Risk Level** (Weight: 25%)
   - Critical = 0-20 points
   - Warning = 21-60 points
   - Normal = 61-100 points
   - Provide details about why this risk level was assigned

2. **Missing Clauses** (Weight: 20%)
   - Check for standard clauses that should be present (e.g., termination, dispute resolution, payment terms, liability limits)
   - Score: 100 - (number of critical missing clauses * 20)
   - List which clauses are missing

3. **Unusual Patterns** (Weight: 20%)
   - Look for suspicious patterns: excessive penalties, unusual terms, hidden fees, one-sided clauses
   - Score: 100 - (number of unusual patterns * 15)
   - List the unusual patterns found

4. **Ambiguous Language** (Weight: 20%)
   - Identify vague, unclear, or potentially misleading language
   - Score: 100 - (number of ambiguous sections * 10)
   - List examples of ambiguous language

5. **Expiry or Outdated Terms** (Weight: 15%)
   - Check for expiration dates, outdated references, obsolete terms
   - Score based on how current and relevant the document is
   - Provide details about expiry or outdated elements

Calculate the overall Trust Score using weighted average:
Trust Score = (Risk Level Score × 0.25) + (Missing Clauses Score × 0.20) + (Unusual Patterns Score × 0.20) + (Ambiguous Language Score × 0.20) + (Expiry Score × 0.15)

Determine status:
- Safe: 70-100
- Needs Review: 40-69
- Dangerous: 0-39

Return ONLY a valid JSON object in this exact format:
{
  "trustScore": 65,
  "status": "Needs Review",
  "factors": {
    "riskLevel": {
      "score": 60,
      "weight": 25,
      "details": "..."
    },
    "missingClauses": {
      "score": 80,
      "weight": 20,
      "details": ["clause 1", "clause 2"]
    },
    "unusualPatterns": {
      "score": 70,
      "weight": 20,
      "details": ["pattern 1", "pattern 2"]
    },
    "ambiguousLanguage": {
      "score": 50,
      "weight": 20,
      "details": ["example 1", "example 2"]
    },
    "expiryOrOutdated": {
      "score": 90,
      "weight": 15,
      "details": "..."
    }
  },
  "summary": "Overall summary of trustworthiness",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Do not include any markdown formatting, code blocks, or additional text. Only the JSON object.`;

    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    // Parse JSON response
    let analysis: TrustScoreAnalysis;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
      
      // Validate and ensure trustScore is within 0-100
      analysis.trustScore = Math.max(0, Math.min(100, Math.round(analysis.trustScore || 50)));
      
      // Ensure status is valid
      if (!['Safe', 'Needs Review', 'Dangerous'].includes(analysis.status)) {
        if (analysis.trustScore >= 70) {
          analysis.status = 'Safe';
        } else if (analysis.trustScore >= 40) {
          analysis.status = 'Needs Review';
        } else {
          analysis.status = 'Dangerous';
        }
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      // Fallback analysis based on risk level
      const riskScore = document.risk_level === 'Critical' ? 20 : 
                       document.risk_level === 'Warning' ? 50 : 80;
      
      analysis = {
        trustScore: riskScore,
        status: riskScore >= 70 ? 'Safe' : riskScore >= 40 ? 'Needs Review' : 'Dangerous',
        factors: {
          riskLevel: {
            score: riskScore,
            weight: 25,
            details: `Document classified as ${document.risk_level} risk`,
          },
          missingClauses: {
            score: 70,
            weight: 20,
            details: ['Unable to analyze - manual review recommended'],
          },
          unusualPatterns: {
            score: 70,
            weight: 20,
            details: ['Unable to analyze - manual review recommended'],
          },
          ambiguousLanguage: {
            score: 70,
            weight: 20,
            details: ['Unable to analyze - manual review recommended'],
          },
          expiryOrOutdated: {
            score: 80,
            weight: 15,
            details: 'Unable to analyze - manual review recommended',
          },
        },
        summary: `Document has a ${document.risk_level} risk level. Manual review recommended.`,
        recommendations: [
          'Review the document carefully',
          'Consult with a legal expert if needed',
          'Verify all terms and conditions',
        ],
      };
    }

    res.json({
      success: true,
      analysis,
      document: {
        id: document.id,
        filename: document.filename,
        riskLevel: document.risk_level,
        riskCategory: document.risk_category,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Trust score error:', error);
    res.status(500).json({
      error: 'Failed to calculate trust score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
