import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent, insertAuditReport } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

const reportSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(20),
});

router.post('/', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const tenantId = authReq.workspace.tenantId;

  try {
    const { documentIds } = reportSchema.parse(req.body);

    const docs = await getDocuments({ tenantId, documentIds });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'No documents found or access denied.' });
    }

    const byId = new Map(docs.map((d: any) => [d.id, d]));
    const ordered = documentIds.map((id) => byId.get(id)).filter(Boolean) as any[];

    // Build deterministic fallback report if OpenAI isn't configured
    let reportText = '';

    if (!config.openai.apiKey) {
      reportText = [
        'Aegis AI — Audit Summary Report',
        '',
        `Documents: ${ordered.length}`,
        ...ordered.map((d: any) => {
          const score = d.risk_score ?? d.riskScore ?? null;
          const level = d.risk_level ?? d.riskLevel ?? null;
          return `- ${d.filename} | riskLevel=${level ?? 'N/A'} | riskScore=${score ?? 'N/A'}`;
        }),
        '',
        'Key Findings:',
        '- Review documents with higher riskScore first.',
        '- Verify invoice totals and GSTIN fields when missing/ambiguous.',
      ].join('\n');
    } else {
      const llm = new ChatOpenAI({
        openAIApiKey: config.openai.apiKey,
        modelName: 'gpt-4o-mini',
        temperature: 0.2,
      });

      const contentBlobs: Array<{ id: string; filename: string; extracted: any; summary?: string | null; riskScore?: number | null; content?: string | null }> = [];
      for (const d of ordered) {
        const content = await getDocumentContent(d.id);
        contentBlobs.push({
          id: d.id,
          filename: d.filename,
          extracted: d.extracted_data || {},
          summary: d.summary ?? null,
          riskScore: d.risk_score ?? null,
          content: content ? content.slice(0, 2500) : null,
        });
      }

      const prompt = `You are Aegis AI. Generate an audit-ready report for a Chartered Accountant.

Requirements:
- Use headings
- Include: Key findings, Mismatches/Risks, Risk score overview, Recommendations
- Be concise but actionable
- Do not invent numbers; if data missing, say 'Not found'

Input JSON:
${JSON.stringify(contentBlobs, null, 2)}

Return plain text only.`;

      const resp = await llm.invoke(prompt);
      reportText = (typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content)).trim();
    }

    const saved = await insertAuditReport({
      tenantId,
      userId: authReq.user.id,
      documentIds,
      report: reportText,
    });

    res.json({
      success: true,
      reportId: saved?.id ?? null,
      report: reportText,
      documentIds,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Report generation error:', e);
    res.status(500).json({
      error: 'Failed to generate report',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
