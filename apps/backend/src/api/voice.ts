import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { queryRAG } from '../services/rag.js';
import { getDocuments } from '../db/pgvector.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

const voiceRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).optional(),
  userLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  language: z.string().optional(), // e.g. 'hi', 'ta', 'en' - 22 Indian languages (Sarvam Saaras v3)
});

// This endpoint processes voice input (transcribed text) and returns text response
// The actual speech-to-text happens on the frontend using Web Speech API
router.post('/query', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']), async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const tenantId = authReq.workspace.tenantId;
    const validated = voiceRequestSchema.parse(req.body);
    const { question, language: bodyLang } = req.body;
    const language = bodyLang ?? validated.language ?? 'en';

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question is required',
        message: 'Please provide a question to process.',
      });
    }

    // Filter documentIds to only include tenant's documents
    let userDocumentIds = validated.documentIds;
    if (userDocumentIds && userDocumentIds.length > 0) {
      const tenantDocs = await getDocuments({ tenantId });
      const tenantDocIds = new Set(tenantDocs.map((d: { id: string }) => d.id));
      userDocumentIds = userDocumentIds.filter(id => tenantDocIds.has(id));
    }

    // Use existing RAG system to answer the question
    const result = await queryRAG(
      question,
      language,
      5, // topK
      userDocumentIds,
      validated.userLocation
    );

    res.json({
      success: true,
      answer: result.answer,
      confidence: result.confidence,
      citations: result.citations,
      sources: result.sources,
      // Add flag to indicate this is a voice response (for TTS)
      voiceResponse: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Voice query error:', error);
    res.status(500).json({
      error: 'Failed to process voice query',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
