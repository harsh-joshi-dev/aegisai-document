/**
 * Contract template generation API
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateTemplate, TemplateRequest } from '../templates/generator.js';

const router = Router();

const generateTemplateSchema = z.object({
  templateType: z.enum(['NDA', 'MSA', 'SOW', 'Employment', 'Service', 'Custom']),
  jurisdiction: z.string().optional(),
  industry: z.string().optional(),
  customRequirements: z.string().optional(),
  includeClauses: z.array(z.string()).optional(),
  excludeClauses: z.array(z.string()).optional(),
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const validated = generateTemplateSchema.parse(req.body);
    
    const result = await generateTemplate(validated as TemplateRequest);
    
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

    console.error('Template generation error:', error);
    res.status(500).json({
      error: 'Failed to generate template',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
