import { Router, Request, Response } from 'express';
import { queryRAG } from '../services/rag.js';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

const chatRequestSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  language: z.string().default('en'),
  topK: z.number().int().min(1).max(10).default(5),
  documentIds: z.array(z.string().uuid()).optional(), // For multi-document chat
  userLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(), // User location for service providers
  /** Role-based view: user = simple explanation, manager = risk & cost focus, auditor = clauses & citations */
  viewAs: z.enum(['user', 'manager', 'auditor']).optional(),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = chatRequestSchema.parse(req.body);
    
    // Filter documentIds to only include user's documents
    let userDocumentIds = validated.documentIds;
    if (userDocumentIds && userDocumentIds.length > 0) {
      const userDocs = await getDocuments({ userId: authReq.user!.id });
      const userDocIds = new Set(userDocs.map((d: { id: string }) => d.id));
      userDocumentIds = userDocumentIds.filter(id => userDocIds.has(id));
    }
    
    const result = await queryRAG(
      validated.question,
      validated.language,
      validated.topK,
      userDocumentIds,
      validated.userLocation,
      validated.viewAs
    );
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat query',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate quick questions based on document content
const quickQuestionsSchema = z.object({
  documentId: z.string().uuid(),
});

router.post('/quick-questions', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = quickQuestionsSchema.parse(req.body);

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

    // Generate quick questions using LLM
    const llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
    });

    const prompt = `Based on the following document, generate 3-5 relevant quick questions that a user might want to ask. 
The questions should be:
1. Contextually relevant to the document content
2. Actionable and useful
3. Cover different aspects (summary, details, next steps, etc.)
4. Written in a natural, conversational way

Document Information:
- Filename: ${document.filename}
- Risk Level: ${document.risk_level}
- Risk Category: ${document.risk_category || 'Not specified'}

Document Content (first 2000 characters):
${content.substring(0, 2000)}

Return ONLY a JSON array of question strings, like this:
["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]

Do not include any other text, explanations, or markdown formatting. Just the JSON array.`;

    const response = await llm.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    // Parse JSON array
    let questions: string[] = [];
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) {
        questions = [];
      }
    } catch (error) {
      // Fallback: generate default questions based on document type
      const filename = document.filename.toLowerCase();
      if (filename.includes('appointment') || filename.includes('prescription')) {
        questions = [
          `Summarize this ${document.filename}`,
          'What should I bring along for this appointment?',
          'What details confirm my payment is complete?',
          'When is my next appointment?',
          'What are the important instructions?'
        ];
      } else if (filename.includes('contract') || filename.includes('agreement')) {
        questions = [
          `Summarize this ${document.filename}`,
          'What are the key terms and conditions?',
          'What are my obligations?',
          'What are the payment terms?',
          'What should I do next?'
        ];
      } else {
        questions = [
          `Summarize this ${document.filename}`,
          'What are the key points?',
          'What should I do next?',
          'What are the important details?',
          'Explain the main content'
        ];
      }
    }

    res.json({
      success: true,
      questions: questions.slice(0, 5), // Limit to 5 questions
    });
  } catch (error) {
    console.error('Quick questions error:', error);
    res.status(500).json({
      error: 'Failed to generate quick questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
