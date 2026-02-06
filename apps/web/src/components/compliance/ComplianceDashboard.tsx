import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import './ComplianceDashboard.css';

interface ComplianceMetrics {
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
}

export default function ComplianceDashboard() {
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await apiClient.get('/api/compliance/metrics');
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to load compliance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="compliance-dashboard">Loading...</div>;
  }

  if (!metrics) {
    return <div className="compliance-dashboard">Failed to load metrics</div>;
  }

  return (
    <div className="compliance-dashboard">
      <h2>🔒 Compliance Dashboard</h2>

      <div className="metrics-grid">
        {/* GDPR Section */}
        <div className="metric-card gdpr">
          <h3>GDPR Compliance</h3>
          <div className="metric-item">
            <span className="label">Data Retention:</span>
            <span className="value">{metrics.gdpr.dataRetentionDays} days</span>
          </div>
          <div className="metric-item">
            <span className="label">Pending Deletions:</span>
            <span className="value warning">{metrics.gdpr.pendingDeletionRequests}</span>
          </div>
          <div className="metric-item">
            <span className="label">Exports Completed:</span>
            <span className="value">{metrics.gdpr.dataExportsCompleted}</span>
          </div>
          <div className="metric-item">
            <span className="label">Data Deleted:</span>
            <span className="value">{metrics.gdpr.userDataDeleted}</span>
          </div>
        </div>

        {/* SOC 2 Section */}
        <div className="metric-card soc2">
          <h3>SOC 2 Compliance</h3>
          <div className="metric-item">
            <span className="label">Total Audit Logs:</span>
            <span className="value">{metrics.soc2.totalAuditLogs.toLocaleString()}</span>
          </div>
          <div className="metric-item">
            <span className="label">Failed Attempts:</span>
            <span className="value critical">{metrics.soc2.failedAccessAttempts}</span>
          </div>
          <div className="metric-item">
            <span className="label">Access Events:</span>
            <span className="value">{metrics.soc2.dataAccessEvents}</span>
          </div>
          <div className="metric-item">
            <span className="label">System Changes:</span>
            <span className="value">{metrics.soc2.systemChanges}</span>
          </div>
        </div>

        {/* Data Retention Section */}
        <div className="metric-card retention">
          <h3>Data Retention</h3>
          <div className="metric-item">
            <span className="label">Older than 30 days:</span>
            <span className="value">{metrics.dataRetention.documentsOlderThan30Days}</span>
          </div>
          <div className="metric-item">
            <span className="label">Older than 90 days:</span>
            <span className="value">{metrics.dataRetention.documentsOlderThan90Days}</span>
          </div>
          <div className="metric-item">
            <span className="label">Older than 1 year:</span>
            <span className="value">{metrics.dataRetention.documentsOlderThan1Year}</span>
          </div>
          <div className="metric-item">
            <span className="label">Auto-Delete:</span>
            <span className={`value ${metrics.dataRetention.autoDeleteEnabled ? 'enabled' : 'disabled'}`}>
              {metrics.dataRetention.autoDeleteEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
