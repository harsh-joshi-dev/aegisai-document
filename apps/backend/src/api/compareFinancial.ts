import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent, insertComparison } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

const compareSchema = z.object({
  docIds: z.array(z.string().uuid()).min(2).max(10),
});

type NormalizedDoc = {
  id: string;
  filename: string;
  extractedData: Record<string, any>;
  summary?: string | null;
  riskScore?: number | null;
  riskLevel?: string | null;
};

function normalizeAmount(n: unknown): number | null {
  const num = typeof n === 'number' ? n : n == null ? null : Number(n);
  return Number.isFinite(num as number) ? (num as number) : null;
}

function riskLevelFromScore(score: number | null | undefined): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score == null) return 'MEDIUM';
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

function detectMismatches(docs: NormalizedDoc[]) {
  // Simple cross-doc: compare totals and GSTINs.
  const totals = docs
    .map((d) => ({ id: d.id, filename: d.filename, totalAmount: normalizeAmount(d.extractedData?.totalAmount) }))
    .filter((x) => x.totalAmount != null);

  const gstins = docs
    .map((d) => ({ id: d.id, filename: d.filename, vendorGstin: d.extractedData?.vendorGstin as string | null | undefined }))
    .filter((x) => x.vendorGstin);

  const mismatches: Array<{ field: string; message: string; docs: any; severity: 'LOW' | 'MEDIUM' | 'HIGH' }> = [];

  if (totals.length >= 2) {
    const values = totals.map((t) => t.totalAmount as number);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const diff = max - min;
    if (diff !== 0) {
      const pct = min === 0 ? null : diff / min;
      const severity: 'LOW' | 'MEDIUM' | 'HIGH' = pct != null && pct > 0.1 ? 'HIGH' : diff > 0 ? 'MEDIUM' : 'LOW';
      mismatches.push({
        field: 'totalAmount',
        message: `Amount mismatch detected. Max ${max} vs Min ${min}.`,
        docs: totals,
        severity,
      });
    }
  }

  if (gstins.length >= 2) {
    const set = new Set(gstins.map((g) => g.vendorGstin));
    if (set.size > 1) {
      mismatches.push({
        field: 'vendorGstin',
        message: 'GSTIN mismatch detected across documents.',
        docs: gstins,
        severity: 'HIGH',
      });
    }
  }

  return mismatches;
}

async function explainWithLLM(params: {
  mismatches: any[];
  docs: NormalizedDoc[];
}): Promise<Record<string, string>> {
  const { mismatches, docs } = params;
  if (!config.openai.apiKey || mismatches.length === 0) return {};

  const llm = new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0.2,
  });

  const prompt = `You are Aegis AI. Explain financial mismatches in a review-friendly way.

Documents (extracted JSON):
${JSON.stringify(docs.map((d) => ({ id: d.id, filename: d.filename, extracted: d.extractedData })), null, 2)}

Mismatches:
${JSON.stringify(mismatches, null, 2)}

Return ONLY a JSON object mapping mismatch index to an explanation string:
{
  "0": "...",
  "1": "..."
}
Keep each explanation to 2-4 sentences.
`;

  const resp = await llm.invoke(prompt);
  const text = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

router.post('/', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const tenantId = authReq.workspace.tenantId;

  try {
    const { docIds } = compareSchema.parse(req.body);

    const docs = await getDocuments({ tenantId, documentIds: docIds });
    if (docs.length < 2) {
      return res.status(404).json({ error: 'Not found', message: 'One or more documents not found or access denied.' });
    }

    // Ensure stable order as requested by user
    const byId = new Map(docs.map((d: any) => [d.id, d]));
    const orderedDocs = docIds.map((id) => byId.get(id)).filter(Boolean) as any[];

    const normalized: NormalizedDoc[] = orderedDocs.map((d: any) => ({
      id: d.id,
      filename: d.filename,
      extractedData: (d.extracted_data || d.extractedData || {}),
      summary: d.summary ?? null,
      riskScore: d.risk_score ?? d.riskScore ?? null,
      riskLevel: d.risk_level ?? d.riskLevel ?? null,
    }));

    // If extractedData empty for some doc, try to infer from content (best-effort)
    for (const nd of normalized) {
      if (nd.extractedData && Object.keys(nd.extractedData).length > 0) continue;
      const content = await getDocumentContent(nd.id);
      if (!content) continue;
      // keep it empty; upload pipeline should populate. We avoid heavy work here.
      nd.extractedData = nd.extractedData || {};
    }

    const mismatches = detectMismatches(normalized);
    const explanations = await explainWithLLM({ mismatches, docs: normalized });

    const riskScore = Math.max(
      ...normalized.map((d) => (typeof d.riskScore === 'number' ? d.riskScore : 0)),
      mismatches.some((m) => m.severity === 'HIGH') ? 80 : 0
    );

    const resultJson = {
      documents: normalized.map((d) => ({
        id: d.id,
        filename: d.filename,
        extractedData: d.extractedData,
        summary: d.summary,
        riskScore: d.riskScore,
        riskLevel: d.riskLevel,
      })),
      mismatches: mismatches.map((m, idx) => ({
        ...m,
        explanation: explanations[String(idx)] ?? null,
      })),
      riskScore: Math.min(100, riskScore),
      riskLevel: riskLevelFromScore(Math.min(100, riskScore)),
      summary: mismatches.length
        ? `Found ${mismatches.length} mismatch(es) across selected documents.`
        : 'No mismatches detected in key fields.'
    };

    const saved = await insertComparison({
      tenantId,
      userId: authReq.user.id,
      docIds,
      resultJson,
    });

    res.json({
      success: true,
      comparisonId: saved?.id ?? null,
      ...resultJson,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Financial compare error:', e);
    res.status(500).json({
      error: 'Failed to compare documents',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
