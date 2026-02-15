import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocumentInsights } from '../db/pgvector.js';
import { requireWorkspaceContext } from '../workspace/middleware.js';
import type { WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

router.get('/:documentId', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const { documentId } = req.params;
  try {
    const insights = await getDocumentInsights({ tenantId: authReq.workspace.tenantId, documentId });
    if (!insights) {
      return res.json({ success: true, insights: null });
    }

    res.json({
      success: true,
      insights: {
        documentId: insights.document_id,
        vendorKey: insights.vendor_key,
        consistencyScore: insights.consistency_score,
        riskScore: insights.risk_score,
        riskReasons: insights.risk_reasons,
        recommendations: insights.recommendations,
        patterns: insights.patterns,
        updatedAt: insights.updated_at,
      },
    });
  } catch (e) {
    console.error('Get insights error:', e);
    res.status(500).json({
      error: 'Failed to get insights',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
