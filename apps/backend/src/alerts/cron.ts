/**
 * Cron job setup for alert checking and DPDP auto-deletion
 */
import cron from 'node-cron';
import { checkAllAlerts, storeAlerts } from './scheduler.js';
import { runDPDPAutoDeletion } from '../compliance/dpdp.js';

/**
 * Setup alert checking cron job - runs daily at 9 AM
 */
export function setupAlertCron(): void {
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
  console.log('✅ Alert cron: daily 9 AM');
}

const DPDP_RETENTION_DAYS = parseInt(process.env.DPDP_RETENTION_DAYS || '90', 10);

/**
 * DPDP auto-deletion cron - runs daily at 2 AM IST; deletes expired ULI cache and loan data
 */
export function setupDPDPCron(): void {
  cron.schedule('0 2 * * *', async () => {
    console.log('🔒 Running DPDP auto-deletion...');
    try {
      const result = await runDPDPAutoDeletion(DPDP_RETENTION_DAYS);
      console.log(`✅ DPDP deletion: ULI cache ${result.uliDeleted}, loan applications ${result.loansDeleted}`);
    } catch (error) {
      console.error('❌ DPDP auto-deletion failed:', error);
    }
  });
  console.log('✅ DPDP cron: daily 2 AM (retention ' + DPDP_RETENTION_DAYS + ' days)');
}
