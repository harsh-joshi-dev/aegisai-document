import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

const explainRequestSchema = z.object({
  documentId: z.string().uuid(),
  language: z.string().default('en'),
  /** Explain like I'm 10 (simple), 20 (detailed), or professional */
  level: z.enum(['simple', 'detailed', 'professional']).default('detailed'),
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
      temperature: 0.1,
    });
  }

  return llm;
}

/**
 * Generate document explanation in selected language
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = explainRequestSchema.parse(req.body);

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

    const level = validated.level;
    const levelInstructions = {
      simple: 'Explain like the reader is 10 years old. Use very simple words, short sentences, and avoid jargon. No legal or technical terms unless you explain them in one simple phrase.',
      detailed: 'Explain for an educated adult (like 20). Be clear and thorough. You may use some technical terms but explain key concepts. Cover summary, risk, what to understand, and next steps.',
      professional: 'Explain for a lawyer/CA/auditor. Use precise legal and business terminology. Include clause references, obligations, and compliance implications where relevant.',
    };

    // Get document content for context
    const { getDocumentContent } = await import('../db/pgvector.js');
    const docContent = await getDocumentContent(validated.documentId);
    const contentSnippet = docContent ? docContent.substring(0, 3000) : '';

    const explanationPrompt = `You are a helpful document analysis assistant. Explain the following document in ${validated.language}.

Document Information:
- Filename: ${document.filename}
- Risk Level: ${document.risk_level}
- Risk Category: ${document.risk_category || 'Not specified'}

Explanation level: ${level}. ${levelInstructions[level]}

${contentSnippet ? `Document content (excerpt):\n${contentSnippet}` : ''}

IMPORTANT: Start your explanation with "I will explain this document to you." Then immediately provide the explanation without any additional introductory phrases like "Sure!", "Let's break down", etc.

Provide a comprehensive explanation that:
1. Summarizes what this document is about
2. Explains why it has been classified as ${document.risk_level} risk
3. Describes what the user should understand
4. Provides clear guidance on what actions they should take next

Write the explanation in ${validated.language}. Be direct and clear.`;

    // Get LLM response
    const llm = getLLM();
    const response = await llm.invoke(explanationPrompt);

    const explanation = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    res.json({
      success: true,
      explanation,
      language: validated.language,
      level: validated.level,
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

    console.error('Explain error:', error);
    res.status(500).json({
      error: 'Failed to generate explanation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
