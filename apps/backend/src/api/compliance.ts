/**
 * Compliance API endpoints
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAuditLogs,
  logAuditEvent,
  deleteUserData,
  exportUserData,
  enforceDataRetention,
} from '../compliance/auditLog.js';
import { getComplianceMetrics, getComplianceReport } from '../compliance/dashboard.js';

const router = Router();

/**
 * Get compliance dashboard metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getComplianceMetrics();
    res.json({
      success: true,
      ...metrics,
    });
  } catch (error) {
    console.error('Compliance metrics error:', error);
    res.status(500).json({
      error: 'Failed to get compliance metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get compliance report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as 'week' | 'month' | 'quarter') || 'month';
    const report = await getComplianceReport(period);
    res.json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error('Compliance report error:', error);
    res.status(500).json({
      error: 'Failed to generate compliance report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get audit logs
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const filters = {
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      complianceFlag: req.query.complianceFlag as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await getAuditLogs(filters);
    res.json({
      success: true,
      logs: result.logs,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({
      error: 'Failed to get audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GDPR: Export user data
 */
router.post('/gdpr/export', async (req: Request, res: Response) => {
  try {
    const { userId } = z.object({
      userId: z.string().min(1),
    }).parse(req.body);

    const data = await exportUserData(userId);

    // Log the export
    await logAuditEvent(
      userId,
      'data_export',
      'user',
      userId,
      { exportedAt: new Date().toISOString() },
      req.ip,
      req.get('user-agent'),
      ['gdpr']
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('GDPR export error:', error);
    res.status(500).json({
      error: 'Failed to export user data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GDPR: Delete user data (right to be forgotten)
 */
router.post('/gdpr/delete', async (req: Request, res: Response) => {
  try {
    const { userId } = z.object({
      userId: z.string().min(1),
    }).parse(req.body);

    const result = await deleteUserData(userId);

    // Log the deletion
    await logAuditEvent(
      userId,
      'data_deletion',
      'user',
      userId,
      { deletedCount: result.deleted },
      req.ip,
      req.get('user-agent'),
      ['gdpr']
    );

    res.json({
      success: true,
      message: 'User data deleted',
      deleted: result.deleted,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('GDPR deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete user data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Enforce data retention policy
 */
router.post('/retention/enforce', async (req: Request, res: Response) => {
  try {
    const { retentionDays } = z.object({
      retentionDays: z.number().int().min(1).max(3650), // Max 10 years
    }).parse(req.body);

    const result = await enforceDataRetention(retentionDays);

    res.json({
      success: true,
      deleted: result.deleted,
      message: `Deleted ${result.deleted} documents older than ${retentionDays} days`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Data retention error:', error);
    res.status(500).json({
      error: 'Failed to enforce data retention',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
