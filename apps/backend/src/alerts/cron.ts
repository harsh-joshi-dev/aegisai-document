/**
 * Cron job setup for alert checking
 */
import cron from 'node-cron';
import { checkAllAlerts, storeAlerts } from './scheduler.js';

/**
 * Setup alert checking cron job
 * Runs daily at 9 AM
 */
export function setupAlertCron(): void {
  // In production, install: npm install node-cron
  // Then uncomment the code below
  
  /*
  const cron = require('node-cron');
  
  // Run daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Running scheduled alert check...');
    try {
      const alerts = await checkAllAlerts();
      await storeAlerts(alerts);
      console.log(`✅ Found ${alerts.length} alerts`);
    } catch (error) {
      console.error('❌ Alert check failed:', error);
    }
  });
  */

  console.log('✅ Alert cron job ready (install node-cron to enable)');
  console.log('   To enable: npm install node-cron');
  console.log('   Then uncomment code in alerts/cron.ts');
}
