/**
 * Risk Trends Dashboard API
 */
import { Router, Request, Response } from 'express';
import { getRiskTrendsDashboard } from '../analytics/dashboard.js';

const router = Router();

router.get('/trends', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string)
      : new Date();
    
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'week';
    
    const dashboard = await getRiskTrendsDashboard(startDate, endDate, groupBy);
    
    res.json({
      success: true,
      ...dashboard,
    });
  } catch (error) {
    console.error('Dashboard trends error:', error);
    res.status(500).json({
      error: 'Failed to get trends',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
