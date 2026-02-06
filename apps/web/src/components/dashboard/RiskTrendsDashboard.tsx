import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import './RiskTrendsDashboard.css';

interface RiskTrendData {
  date: string;
  critical: number;
  warning: number;
  normal: number;
  total: number;
  riskScore: number;
}

interface DashboardData {
  period: {
    start: string;
    end: string;
    days: number;
  };
  riskLevelTrends: RiskTrendData[];
  summary: {
    totalDocuments: number;
    averageRiskScore: number;
    peakRiskDate: string;
    peakRiskScore: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
  };
}

export default function RiskTrendsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    loadDashboard();
  }, [groupBy]);

  const loadDashboard = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Last 90 days

      const response = await apiClient.get('/api/dashboard/trends', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          groupBy,
        },
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="risk-trends-dashboard">Loading...</div>;
  }

  if (!data) {
    return <div className="risk-trends-dashboard">Failed to load data</div>;
  }

  return (
    <div className="risk-trends-dashboard">
      <div className="dashboard-header">
        <h2>📊 Risk Trends Dashboard</h2>
        <div className="controls">
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
            <option value="day">By Day</option>
            <option value="week">By Week</option>
            <option value="month">By Month</option>
          </select>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="label">Total Documents</div>
          <div className="value">{data.summary.totalDocuments}</div>
        </div>
        <div className="summary-card">
          <div className="label">Average Risk Score</div>
          <div className="value">{data.summary.averageRiskScore}</div>
        </div>
        <div className="summary-card">
          <div className="label">Trend</div>
          <div className={`value trend-${data.summary.trendDirection}`}>
            {data.summary.trendDirection === 'increasing' ? '↑' :
              data.summary.trendDirection === 'decreasing' ? '↓' : '→'}
            {Math.abs(data.summary.trendPercentage)}%
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Peak Risk Date</div>
          <div className="value">{data.summary.peakRiskDate}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Risk Level Trends</h3>
        <div className="chart-placeholder">
          {/* In production, integrate Chart.js or D3 here */}
          <div className="chart-bars">
            {data.riskLevelTrends.map((trend, idx) => (
              <div key={idx} className="chart-bar-group">
                <div className="bar-label">{trend.date}</div>
                <div className="bars">
                  <div
                    className="bar critical"
                    style={{ height: `${(trend.critical / trend.total) * 100}%` }}
                    title={`Critical: ${trend.critical}`}
                  />
                  <div
                    className="bar warning"
                    style={{ height: `${(trend.warning / trend.total) * 100}%` }}
                    title={`Warning: ${trend.warning}`}
                  />
                  <div
                    className="bar normal"
                    style={{ height: `${(trend.normal / trend.total) * 100}%` }}
                    title={`Normal: ${trend.normal}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
