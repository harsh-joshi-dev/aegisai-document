/**
 * Indic language APIs - Sarvam vision (OCR) and document classification
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { sarvamVision, getSupportedIndicLanguages } from '../integrations/sarvam.js';

const router = Router();

router.post('/vision', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = z.object({
      imageBase64: z.string().min(1),
      language: z.enum(['hi', 'gu', 'ta', 'te', 'mr', 'bn', 'kn', 'ml', 'en', 'hinglish']).optional(),
      detectDocumentType: z.boolean().optional().default(true),
    }).parse(req.body);
    const result = await sarvamVision(body.imageBase64, {
      language: body.language,
      detectDocumentType: body.detectDocumentType,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Indic vision error:', e);
    res.status(500).json({
      error: 'Indic OCR failed',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.get('/languages', (_req: Request, res: Response) => {
  res.json({ success: true, languages: getSupportedIndicLanguages() });
});

export default router;
