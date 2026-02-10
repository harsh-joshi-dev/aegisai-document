/**
 * Scam / Fraud Probability Score: detect unusual language, fake authority, payment urgency.
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
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { documentId } = schema.parse(req.body);

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
        scamProbability: 0,
        signals: [],
        summary: 'Document content not available for scam analysis.',
      });
    }

    const prompt = `You are a fraud/scam detection analyst. Analyze this document for signs of scam or fraud.

Document: ${doc.filename}

Content:
${content.substring(0, 6000)}

Consider: unusual or threatening language, fake authority (impersonation), payment urgency, requests for personal/financial details, too-good-to-be-true claims, grammar/spelling typical of scams, impersonation of government/banks.

Return ONLY a JSON object (no markdown):
{
  "scamProbability": number 0-100 (0 = likely legitimate, 100 = likely scam),
  "signals": [
    { "type": "payment_urgency" | "fake_authority" | "unusual_language" | "personal_data_request" | "threat" | "other", "description": "short", "severity": "High" | "Medium" | "Low" }
  ],
  "summary": "One sentence for the user (e.g. This document shows moderate scam indicators. Verify sender before acting.)"
}`;

    const response = await getLLM().invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let result: { scamProbability: number; signals: unknown[]; summary: string };
    try {
      result = JSON.parse(cleaned);
      if (typeof result.scamProbability !== 'number') result.scamProbability = 0;
      if (!Array.isArray(result.signals)) result.signals = [];
      if (!result.summary) result.summary = 'Analysis complete.';
    } catch {
      result = { scamProbability: 0, signals: [], summary: 'Unable to compute scam probability.' };
    }

    res.json({
      success: true,
      documentId,
      scamProbability: Math.min(100, Math.max(0, result.scamProbability)),
      signals: result.signals,
      summary: result.summary,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: e.errors });
    console.error('Scam score error:', e);
    res.status(500).json({
      error: 'Failed to compute scam score',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
