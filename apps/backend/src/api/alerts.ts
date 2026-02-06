/**
 * Smart Alerts API
 */
import { Router, Request, Response } from 'express';
import { checkAllAlerts, storeAlerts, getPendingAlerts, markAlertSent } from '../alerts/scheduler.js';

const router = Router();

/**
 * Check for new alerts (manual trigger)
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const alerts = await checkAllAlerts();
    await storeAlerts(alerts);
    
    res.json({
      success: true,
      alertsFound: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Alert check error:', error);
    res.status(500).json({
      error: 'Failed to check alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get pending alerts
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const alerts = await getPendingAlerts(limit);
    
    res.json({
      success: true,
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Mark alert as sent
 */
router.post('/:alertId/sent', async (req: Request, res: Response) => {
  try {
    await markAlertSent(req.params.alertId);
    
    res.json({
      success: true,
      message: 'Alert marked as sent',
    });
  } catch (error) {
    console.error('Mark alert sent error:', error);
    res.status(500).json({
      error: 'Failed to mark alert as sent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
