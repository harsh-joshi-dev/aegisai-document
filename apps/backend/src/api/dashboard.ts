/**
 * Financial Health Dashboard API
 * GET /api/dashboard/health – aggregate document risk and compliance summary
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDocuments, pool } from '../db/pgvector.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

export type RiskLevel = 'Green' | 'Yellow' | 'Red';

router.get('/health', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    const tenantId = authReq.workspace?.tenantId;
    if (!authReq.user?.id || !tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const docs = await getDocuments({ tenantId });
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

router.get(
  '/summary',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']),
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const tenantId = authReq.workspace.tenantId;
    try {
      const [docsCount, pendingApprovals, highRiskCount] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS c FROM documents WHERE tenant_id = $1`, [tenantId]),
        pool.query(
          `SELECT COUNT(*)::int AS c
           FROM approvals
           WHERE tenant_id = $1 AND status IN ('pending','info_requested')`,
          [tenantId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c
           FROM risk_results
           WHERE tenant_id = $1 AND (risk_level IN ('High Risk','Critical') OR risk_score >= 61)`,
          [tenantId]
        ),
      ]);

      res.json({
        success: true,
        summary: {
          total_docs: (docsCount.rows[0] as any).c as number,
          pending_approvals: (pendingApprovals.rows[0] as any).c as number,
          high_risk_count: (highRiskCount.rows[0] as any).c as number,
        },
      });
    } catch (e) {
      console.error('Dashboard summary error:', e);
      res.status(500).json({
        error: 'Failed to load dashboard summary',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }
);

router.get(
  '/alerts',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']),
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const tenantId = authReq.workspace.tenantId;
    try {
      const result = await pool.query(
        `SELECT id, document_id, vendor_key, event_type, severity, title, details, created_at
         FROM pattern_events
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [tenantId]
      );
      res.json({ success: true, alerts: result.rows });
    } catch (e) {
      console.error('Dashboard alerts error:', e);
      res.status(500).json({
        error: 'Failed to load alerts',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }
);

export default router;
