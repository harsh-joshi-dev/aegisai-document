/**
 * PII Redaction API
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { redactPII, sanitizeForAnalysis } from '../redaction/sanitizer.js';

const router = Router();

const redactSchema = z.object({
  text: z.string().min(1),
  options: z.object({
    redactEmail: z.boolean().optional(),
    redactPhone: z.boolean().optional(),
    redactSSN: z.boolean().optional(),
    redactCreditCard: z.boolean().optional(),
    redactIP: z.boolean().optional(),
  }).optional(),
});

router.post('/redact', async (req: Request, res: Response) => {
  try {
    const validated = redactSchema.parse(req.body);
    
    const result = await redactPII(validated.text, validated.options);
    
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

    console.error('Redaction error:', error);
    res.status(500).json({
      error: 'Failed to redact PII',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/sanitize', async (req: Request, res: Response) => {
  try {
    const { text } = z.object({
      text: z.string().min(1),
    }).parse(req.body);
    
    const sanitized = await sanitizeForAnalysis(text);
    
    res.json({
      success: true,
      sanitizedText: sanitized,
      originalLength: text.length,
      sanitizedLength: sanitized.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Sanitization error:', error);
    res.status(500).json({
      error: 'Failed to sanitize text',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
