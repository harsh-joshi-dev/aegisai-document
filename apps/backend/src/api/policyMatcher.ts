/**
 * Policy & SOP Matcher: upload company policy, compare with contract, flag violations and missing clauses.
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

const matchSchema = z.object({
  policyDocumentId: z.string().uuid(),
  contractDocumentId: z.string().uuid(),
});

router.post('/match', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const { policyDocumentId, contractDocumentId } = matchSchema.parse(req.body);

    const docs = await getDocuments({ userId, documentIds: [policyDocumentId, contractDocumentId] });
    if (docs.length < 2) {
      return res.status(404).json({ error: 'One or both documents not found' });
    }

    const policyContent = await getDocumentContent(policyDocumentId);
    const contractContent = await getDocumentContent(contractDocumentId);
    const policyDoc = docs.find((d: { id: string }) => d.id === policyDocumentId) as { filename: string };
    const contractDoc = docs.find((d: { id: string }) => d.id === contractDocumentId) as { filename: string };

    if (!policyContent || !contractContent) {
      return res.json({
        success: true,
        policyViolations: [],
        missingClauses: [],
        summary: 'Could not load one or both documents for comparison.',
      });
    }

    const prompt = `You are a compliance analyst. Compare the company POLICY document with the CONTRACT document.

POLICY (company rules/SOP):
${policyContent.substring(0, 4000)}

CONTRACT:
${contractContent.substring(0, 4000)}

Return ONLY a JSON object (no markdown):
{
  "policyViolations": [
    { "policyRule": "short rule from policy", "contractClause": "relevant contract text", "severity": "High" | "Medium" | "Low", "description": "how contract violates policy" }
  ],
  "missingClauses": [
    { "requiredByPolicy": "what policy requires", "suggestion": "what should be in contract", "priority": "Critical" | "High" | "Medium" | "Low" }
  ],
  "summary": "One paragraph summary for the user."
}
Use empty arrays if none.`;

    const response = await getLLM().invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let result: { policyViolations: unknown[]; missingClauses: unknown[]; summary: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { policyViolations: [], missingClauses: [], summary: 'Unable to compare documents.' };
    }

    res.json({
      success: true,
      policyDocumentId,
      contractDocumentId,
      policyFilename: policyDoc?.filename,
      contractFilename: contractDoc?.filename,
      ...result,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: e.errors });
    console.error('Policy match error:', e);
    res.status(500).json({
      error: 'Failed to match policy with contract',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
