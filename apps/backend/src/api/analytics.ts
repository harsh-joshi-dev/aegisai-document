/**
 * Historical analytics API
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getRiskTrends, getRiskExposure } from '../analytics/historical.js';

const router = Router();

router.get('/trends', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months ago
    
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string)
      : new Date();
    
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'week';
    
    const result = await getRiskTrends(startDate, endDate, groupBy);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      error: 'Failed to get trends',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/exposure', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    
    const result = await getRiskExposure(months);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Exposure analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze exposure',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
