/**
 * Negotiation preparation API
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { prepareNegotiation } from '../agents/negotiationPrep.js';

const router = Router();

const negotiationPrepSchema = z.object({
  documentText: z.string().min(100, 'Document text must be at least 100 characters'),
});

router.post('/prepare', requireAuth, async (req: Request, res: Response) => {
  try {
    const validated = negotiationPrepSchema.parse(req.body);
    
    const result = await prepareNegotiation(validated.documentText);
    
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

    console.error('Negotiation prep error:', error);
    res.status(500).json({
      error: 'Failed to prepare negotiation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
