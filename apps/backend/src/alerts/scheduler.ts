/**
 * Alert Scheduler
 * Cron jobs for checking and sending alerts
 */
import { pool } from '../db/pgvector.js';
import { extractDates, generateAlerts } from './extractor.js';
import { getDocumentContent } from '../db/pgvector.js';

export interface AlertJob {
  id: string;
  documentId: string;
  documentName: string;
  alert: ContractAlert;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

/**
 * Check all documents for alerts
 */
export async function checkAllAlerts(): Promise<AlertJob[]> {
  const client = await pool.connect();
  try {
    // Get all documents with recent activity
    const result = await client.query(`
      SELECT id, filename, uploaded_at, metadata
      FROM documents
      WHERE uploaded_at >= NOW() - INTERVAL '1 year'
      ORDER BY uploaded_at DESC
    `);

    const alerts: AlertJob[] = [];

    for (const doc of result.rows) {
      try {
        // Get document content
        const content = await getDocumentContent(doc.id);
        if (!content) continue;

        // Extract dates
        const dates = await extractDates(content);

        // Generate alerts
        const docAlerts = generateAlerts(
          doc.id,
          doc.filename,
          dates,
          {
            expirationDays: 30,
            renewalDays: 60,
            deadlineDays: 7,
          }
        );

        // Create alert jobs
        for (const alert of docAlerts) {
          alerts.push({
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            documentId: doc.id,
            documentName: doc.filename,
            alert,
            sent: false,
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        // Continue with next document
      }
    }

    return alerts;
  } finally {
    client.release();
  }
}

/**
 * Store alerts in database
 */
export async function storeAlerts(alerts: AlertJob[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create alerts table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id VARCHAR(255) PRIMARY KEY,
        document_id UUID REFERENCES documents(id),
        document_name VARCHAR(255),
        alert_type VARCHAR(50),
        date DATE,
        days_until INTEGER,
        description TEXT,
        priority VARCHAR(20),
        sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert alerts
    for (const alert of alerts) {
      await client.query(
        `INSERT INTO alerts (id, document_id, document_name, alert_type, date, days_until, description, priority, sent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          alert.id,
          alert.documentId,
          alert.documentName,
          alert.alert.alertType,
          alert.alert.date,
          alert.alert.daysUntil,
          alert.alert.description,
          alert.alert.priority,
          alert.sent,
          alert.createdAt,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get pending alerts
 */
export async function getPendingAlerts(limit: number = 50): Promise<AlertJob[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM alerts
       WHERE sent = FALSE
       ORDER BY 
         CASE priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         days_until ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      documentName: row.document_name,
      alert: {
        documentId: row.document_id,
        documentName: row.document_name,
        alertType: row.alert_type,
        date: row.date,
        daysUntil: row.days_until,
        description: row.description,
        priority: row.priority,
      },
      sent: row.sent,
      sentAt: row.sent_at,
      createdAt: row.created_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Mark alert as sent
 */
export async function markAlertSent(alertId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE alerts SET sent = TRUE, sent_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [alertId]
    );
  } finally {
    client.release();
  }
}
