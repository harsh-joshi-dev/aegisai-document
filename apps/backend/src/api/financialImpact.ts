/**
 * Financial Impact Estimator: tax payable, late fees, interest, worst-case exposure.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

let llm: InstanceType<typeof ChatOpenAI> | null = null;

function getLLM() {
  if (!llm) {
    if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY is not set');
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
    });
  }
  return llm;
}

const schema = z.object({
  documentId: z.string().uuid(),
  scenario: z.string().optional(), // e.g. "unpaid for 3 months"
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { documentId, scenario } = schema.parse(req.body);

    const docs = await getDocuments({ userId: authReq.user!.id, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const content = await getDocumentContent(documentId);
    const doc = docs[0] as { filename: string };
    if (!content) {
      return res.json({
        success: true,
        documentId,
        estimate: {
          taxPayable: null,
          lateFees: null,
          interest: null,
          worstCaseExposure: null,
          summary: 'Document content not available for financial estimate.',
          scenario: scenario || null,
        },
      });
    }

    const prompt = `You are a financial impact analyst. For this document, estimate financial impact.

Document: ${doc.filename}
${scenario ? `Scenario: ${scenario}` : ''}

Content (first 5000 chars):
${content.substring(0, 5000)}

Return ONLY a JSON object (no markdown):
{
  "taxPayable": { "amount": number or null, "currency": "INR" or "USD", "description": "short" },
  "lateFees": { "amount": number or null, "currency": "INR" or "USD", "description": "short" },
  "interest": { "amount": number or null, "rate": "e.g. 12% p.a.", "description": "short" },
  "worstCaseExposure": { "amount": number or null, "currency": "INR" or "USD", "description": "e.g. If unpaid for 3 months, penalty could be ₹48,000" },
  "summary": "One sentence for the user (e.g. If unpaid for 3 months, penalty could be ₹48,000.)"
}
Use null for any field that does not apply. Use INR when document is India-related, else USD.`;

    const response = await getLLM().invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let estimate: Record<string, unknown>;
    try {
      estimate = JSON.parse(cleaned);
    } catch {
      estimate = {
        taxPayable: null,
        lateFees: null,
        interest: null,
        worstCaseExposure: null,
        summary: 'Unable to compute financial impact from document.',
        scenario: scenario || null,
      };
    }

    res.json({ success: true, documentId, estimate: { ...estimate, scenario: scenario || null } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Financial impact error:', e);
    res.status(500).json({
      error: 'Failed to estimate financial impact',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
