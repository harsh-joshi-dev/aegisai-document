/**
 * Compliance Dashboard Data
 * Provides metrics and insights for SOC 2 / GDPR compliance
 */
import { pool } from '../db/pgvector.js';
import { getAuditLogs } from './auditLog.js';

export interface ComplianceMetrics {
  gdpr: {
    dataRetentionDays: number;
    pendingDeletionRequests: number;
    dataExportsCompleted: number;
    userDataDeleted: number;
  };
  soc2: {
    totalAuditLogs: number;
    failedAccessAttempts: number;
    dataAccessEvents: number;
    systemChanges: number;
  };
  dataRetention: {
    documentsOlderThan30Days: number;
    documentsOlderThan90Days: number;
    documentsOlderThan1Year: number;
    autoDeleteEnabled: boolean;
  };
  accessControl: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    lastAccessAudit: Date | null;
  };
}

/**
 * Get compliance metrics
 */
export async function getComplianceMetrics(): Promise<ComplianceMetrics> {
  const client = await pool.connect();
  try {
    // GDPR metrics
    const gdprMetrics = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE action = 'data_export') as exports,
        COUNT(*) FILTER (WHERE action = 'data_deletion') as deletions,
        COUNT(*) FILTER (WHERE action = 'deletion_request') as pending_requests
      FROM audit_logs
      WHERE 'gdpr' = ANY(compliance_flags)
      AND timestamp >= NOW() - INTERVAL '30 days'
    `);

    // SOC 2 metrics
    const soc2Metrics = await client.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE action LIKE '%failed%' OR action LIKE '%denied%') as failed_attempts,
        COUNT(*) FILTER (WHERE action LIKE '%access%' OR action LIKE '%view%') as access_events,
        COUNT(*) FILTER (WHERE action LIKE '%create%' OR action LIKE '%update%' OR action LIKE '%delete%') as system_changes
      FROM audit_logs
      WHERE 'soc2' = ANY(compliance_flags)
      AND timestamp >= NOW() - INTERVAL '30 days'
    `);

    // Data retention metrics
    const retentionMetrics = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE uploaded_at < NOW() - INTERVAL '30 days') as older_30d,
        COUNT(*) FILTER (WHERE uploaded_at < NOW() - INTERVAL '90 days') as older_90d,
        COUNT(*) FILTER (WHERE uploaded_at < NOW() - INTERVAL '1 year') as older_1y
      FROM documents
    `);

    // Access control metrics (placeholder - would come from user management)
    const accessMetrics = {
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0,
      lastAccessAudit: null as Date | null,
    };

    return {
      gdpr: {
        dataRetentionDays: 90, // Configurable
        pendingDeletionRequests: parseInt(gdprMetrics.rows[0]?.pending_requests || '0'),
        dataExportsCompleted: parseInt(gdprMetrics.rows[0]?.exports || '0'),
        userDataDeleted: parseInt(gdprMetrics.rows[0]?.deletions || '0'),
      },
      soc2: {
        totalAuditLogs: parseInt(soc2Metrics.rows[0]?.total_logs || '0'),
        failedAccessAttempts: parseInt(soc2Metrics.rows[0]?.failed_attempts || '0'),
        dataAccessEvents: parseInt(soc2Metrics.rows[0]?.access_events || '0'),
        systemChanges: parseInt(soc2Metrics.rows[0]?.system_changes || '0'),
      },
      dataRetention: {
        documentsOlderThan30Days: parseInt(retentionMetrics.rows[0]?.older_30d || '0'),
        documentsOlderThan90Days: parseInt(retentionMetrics.rows[0]?.older_90d || '0'),
        documentsOlderThan1Year: parseInt(retentionMetrics.rows[0]?.older_1y || '0'),
        autoDeleteEnabled: true, // Configurable
      },
      accessControl: accessMetrics,
    };
  } finally {
    client.release();
  }
}

/**
 * Get compliance report
 */
export async function getComplianceReport(period: 'week' | 'month' | 'quarter' = 'month'): Promise<{
  period: string;
  metrics: ComplianceMetrics;
  violations: Array<{ type: string; severity: string; description: string; date: Date }>;
  recommendations: string[];
}> {
  const metrics = await getComplianceMetrics();
  
  // Check for violations
  const violations: Array<{ type: string; severity: string; description: string; date: Date }> = [];
  
  if (metrics.soc2.failedAccessAttempts > 10) {
    violations.push({
      type: 'SOC2',
      severity: 'high',
      description: 'High number of failed access attempts detected',
      date: new Date(),
    });
  }

  if (metrics.gdpr.pendingDeletionRequests > 5) {
    violations.push({
      type: 'GDPR',
      severity: 'medium',
      description: 'Multiple pending deletion requests',
      date: new Date(),
    });
  }

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (metrics.dataRetention.documentsOlderThan1Year > 100) {
    recommendations.push('Consider implementing automated data retention policies for documents older than 1 year');
  }

  if (metrics.soc2.failedAccessAttempts > 5) {
    recommendations.push('Review and strengthen access controls - multiple failed attempts detected');
  }

  return {
    period,
    metrics,
    violations,
    recommendations,
  };
}
