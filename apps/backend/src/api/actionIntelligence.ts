import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import { getWhatShouldIDoNext } from '../services/actionIntelligence.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

const schema = z.object({
  documentId: z.string().uuid(),
});

router.post('/', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']), async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const tenantId = authReq.workspace.tenantId;
    const { documentId } = schema.parse(req.body);

    const docs = await getDocuments({ tenantId, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document not found', message: 'You do not have access to this document.' });
    }

    const doc = docs[0] as { id: string; filename: string; risk_level?: string; risk_category?: string | null };
    const result = await getWhatShouldIDoNext(doc.id, doc.filename, doc.risk_level, doc.risk_category);

    res.json({ success: true, documentId, result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Action intelligence error:', e);
    res.status(500).json({
      error: 'Failed to get action intelligence',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
