/**
 * Financial Health Dashboard API
 * GET /api/dashboard/health – aggregate document risk and compliance summary
 */
import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';

const router = Router();

export type RiskLevel = 'Green' | 'Yellow' | 'Red';

router.get('/health', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const docs = await getDocuments({ userId });
    const criticalCount = docs.filter((d: { risk_level?: string }) => d.risk_level === 'Critical').length;
    const warningCount = docs.filter((d: { risk_level?: string }) => d.risk_level === 'Warning').length;
    const normalCount = docs.filter((d: { risk_level?: string }) => d.risk_level === 'Normal').length;

    let riskLevel: RiskLevel = 'Green';
    if (criticalCount > 0) riskLevel = 'Red';
    else if (warningCount > 0) riskLevel = 'Yellow';

    const suggestExpert = riskLevel === 'Red' || (riskLevel === 'Yellow' && warningCount >= 3);
    const message =
      riskLevel === 'Green'
        ? 'No tax liability or critical issues identified. Next check suggested: end of quarter.'
        : riskLevel === 'Yellow'
          ? 'Some documents need attention. Review warning items and consider consulting a CA for tax matters.'
          : 'Critical items require immediate attention. We recommend connecting with a CA or tax expert.';

    res.json({
      success: true,
      summary: {
        totalDocuments: docs.length,
        criticalCount,
        warningCount,
        normalCount,
        riskLevel,
        message,
        suggestExpert,
        youAreSafe: riskLevel === 'Green' && docs.length > 0,
      },
    });
  } catch (error) {
    console.error('Dashboard health error:', error);
    res.status(500).json({
      error: 'Failed to load dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
