/**
 * "Why Is This Risky?" – risk clauses with red/amber/green severity for document viewer.
 */
import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent } from '../db/pgvector.js';
import { pool } from '../db/pgvector.js';
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

export interface RiskClauseItem {
  severity: 'red' | 'amber' | 'green';
  clauseText: string;
  startOffset?: number;
  endOffset?: number;
  reason: string;
}

router.get('/:documentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const documentId = req.params.documentId;

    const docs = await getDocuments({ userId: authReq.user!.id, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const content = await getDocumentContent(documentId);
    const doc = docs[0] as { filename: string; risk_level: string };
    if (!content) {
      return res.json({
        success: true,
        documentId,
        clauses: [],
        summary: 'Document content not available for risk breakdown.',
      });
    }

    const prompt = `You are a legal/compliance analyst. Identify exact clauses or phrases in this document that cause risk. Classify each as red (high risk), amber (moderate), or green (low/safe).

Document: ${doc.filename}
Risk level: ${doc.risk_level}

Content:
${content.substring(0, 8000)}

Return ONLY a JSON array (no markdown):
[
  { "severity": "red" | "amber" | "green", "clauseText": "exact quote from document", "reason": "why this is risky or safe" }
]
Include 3-15 items. "green" = protective or low-risk clauses. "red" = high risk (liability, penalty, unfair terms). "amber" = moderate concern.`;

    const response = await getLLM().invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let clauses: RiskClauseItem[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      clauses = Array.isArray(parsed) ? parsed : [];
      for (const c of clauses) {
        if (!c.severity) c.severity = 'amber';
        if (!c.clauseText) c.clauseText = '';
        if (!c.reason) c.reason = '';
        if (c.clauseText && content.includes(c.clauseText.substring(0, 50))) {
          const idx = content.indexOf(c.clauseText.substring(0, 50));
          c.startOffset = idx;
          c.endOffset = idx + c.clauseText.length;
        }
      }
    } catch {
      clauses = [];
    }

    const summary =
      clauses.length === 0
        ? 'No specific risk clauses could be extracted. Review the document manually.'
        : `Found ${clauses.filter((c) => c.severity === 'red').length} high-risk, ${clauses.filter((c) => c.severity === 'amber').length} moderate, and ${clauses.filter((c) => c.severity === 'green').length} low-risk clauses.`;

    res.json({ success: true, documentId, clauses, summary });
  } catch (e) {
    console.error('Risk clauses error:', e);
    res.status(500).json({
      error: 'Failed to get risk breakdown',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
