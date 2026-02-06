/**
 * Audit Logging System for SOC 2 / GDPR Compliance
 * Tracks all user actions, data access, and system events
 */
import { pool } from '../db/pgvector.js';

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string; // 'document', 'user', 'rule', etc.
  resourceId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  complianceFlags: string[]; // 'gdpr', 'soc2', 'hipaa', etc.
}

/**
 * Initialize audit log table
 */
export async function initializeAuditLogs(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(255),
        details JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        compliance_flags TEXT[] DEFAULT ARRAY[]::TEXT[]
      );
    `);

    // Create indexes for compliance queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    `);

    console.log('✅ Audit logs table initialized');
  } catch (error) {
    console.error('Error initializing audit logs:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string,
  complianceFlags: string[] = []
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO audit_logs 
       (user_id, action, resource_type, resource_id, details, ip_address, user_agent, compliance_flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        ipAddress,
        userAgent,
        complianceFlags,
      ]
    );
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - audit logging should not break the application
  } finally {
    client.release();
  }
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  complianceFlag?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.resourceType) {
      query += ` AND resource_type = $${paramIndex}`;
      params.push(filters.resourceType);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.complianceFlag) {
      query += ` AND $${paramIndex} = ANY(compliance_flags)`;
      params.push(filters.complianceFlag);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    query += ` ORDER BY timestamp DESC`;
    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }
    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const result = await client.query(query, params);

    const logs: AuditLog[] = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: row.timestamp,
      complianceFlags: row.compliance_flags || [],
    }));

    return { logs, total };
  } finally {
    client.release();
  }
}

/**
 * GDPR: Delete user data (right to be forgotten)
 */
export async function deleteUserData(userId: string): Promise<{ deleted: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete documents
    const docResult = await client.query('DELETE FROM documents WHERE metadata->>\'userId\' = $1', [userId]);
    const docCount = docResult.rowCount || 0;

    // Delete audit logs (anonymize instead of delete for compliance)
    await client.query(
      `UPDATE audit_logs 
       SET user_id = 'deleted_user', details = jsonb_set(details, '{gdpr_deleted}', 'true')
       WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    return { deleted: docCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * GDPR: Export user data (data portability)
 */
export async function exportUserData(userId: string): Promise<Record<string, any>> {
  const client = await pool.connect();
  try {
    // Get all user documents
    const docsResult = await client.query(
      'SELECT * FROM documents WHERE metadata->>\'userId\' = $1',
      [userId]
    );

    // Get user audit logs
    const logsResult = await client.query(
      'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp',
      [userId]
    );

    return {
      userId,
      exportedAt: new Date().toISOString(),
      documents: docsResult.rows,
      auditLogs: logsResult.rows,
    };
  } finally {
    client.release();
  }
}

/**
 * Data retention: Delete old data based on retention policy
 */
export async function enforceDataRetention(retentionDays: number): Promise<{ deleted: number }> {
  const client = await pool.connect();
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await client.query(
      `DELETE FROM documents 
       WHERE uploaded_at < $1 
       AND metadata->>'retentionPolicy' = 'auto-delete'`,
      [cutoffDate]
    );

    return { deleted: result.rowCount || 0 };
  } finally {
    client.release();
  }
}
