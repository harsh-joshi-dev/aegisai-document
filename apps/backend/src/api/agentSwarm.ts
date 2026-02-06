import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import { executeAgentSwarm } from '../agents/orchestrator.js';

const router = Router();

const agentSwarmRequestSchema = z.object({
  documentId: z.string().uuid(),
  userParty: z.string().optional(), // Which party the user represents
  jurisdictions: z.array(z.string()).optional(), // Specific jurisdictions to check
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = agentSwarmRequestSchema.parse(req.body);

    // Verify user owns this document
    const userDocuments = await getDocuments({
      userId: authReq.user!.id,
      documentIds: [validated.documentId],
    });

    if (userDocuments.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document does not exist or you do not have access to it.',
      });
    }

    const document = userDocuments[0];

    // Execute agent swarm
    console.log(`[API] Starting agent swarm for document ${validated.documentId}`);
    const result = await executeAgentSwarm(
      validated.documentId,
      document.filename,
      validated.userParty,
      validated.jurisdictions
    );

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Agent swarm error:', error);
    res.status(500).json({
      error: 'Failed to execute agent swarm',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
