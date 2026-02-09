/**
 * Finance & Tax Tools API
 * POST /api/finance-tools/run – run a tool over selected documents
 * GET  /api/finance-tools/list – list available tools
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import { runFinanceTool } from '../services/financeTools/runner.js';
import { getAllToolConfigs, FINANCE_TOOL_IDS, type FinanceToolId } from '../services/financeTools/prompts.js';

const router = Router();

const runSchema = z.object({
  toolId: z.enum(FINANCE_TOOL_IDS as unknown as [string, ...string[]]),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document is required'),
});

router.get('/list', requireAuth, (_req: Request, res: Response) => {
  const list = getAllToolConfigs();
  res.json({ success: true, tools: list });
});

router.post('/run', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const validated = runSchema.parse(req.body);

    const userDocs = await getDocuments({ userId, documentIds: validated.documentIds });
    const allowedIds = new Set(userDocs.map((d: { id: string }) => d.id));
    const documentIds = validated.documentIds.filter((id) => allowedIds.has(id));

    if (documentIds.length === 0) {
      return res.status(400).json({
        error: 'No accessible documents',
        message: 'Select documents that belong to you.',
      });
    }

    const idToFilename = new Map(userDocs.map((d: { id: string; filename: string }) => [d.id, d.filename]));
    const result = await runFinanceTool(validated.toolId as FinanceToolId, documentIds, { idToFilename });
    res.json({ success: true, result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: err.errors,
      });
    }
    console.error('Finance tool error:', err);
    res.status(500).json({
      error: 'Failed to run finance tool',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
