/**
 * Benchmarking API
 */
import { Router, Request, Response } from 'express';
import { getBenchmarkComparison } from '../benchmarking/industry.js';

const router = Router();

router.get('/compare', async (req: Request, res: Response) => {
  try {
    const industry = req.query.industry as string | undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const comparison = await getBenchmarkComparison(industry, userId, startDate, endDate);
    
    res.json({
      success: true,
      ...comparison,
    });
  } catch (error) {
    console.error('Benchmarking error:', error);
    res.status(500).json({
      error: 'Failed to get benchmark comparison',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
