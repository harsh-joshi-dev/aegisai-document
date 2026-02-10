import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  LineChart,
  Line,
} from 'recharts';
import './RiskTrendsDashboard.css';

interface RiskTrendData {
  date: string;
  critical: number;
  warning: number;
  normal: number;
  total: number;
  riskScore?: number;
}

interface DashboardData {
  period: { start: string; end: string; days: number };
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

const CRITICAL_COLOR = '#dc2626';
const WARNING_COLOR = '#f59e0b';
const NORMAL_COLOR = '#16a34a';

function mapAnalyticsToDashboard(raw: any): DashboardData {
  const riskLevel = raw.trends?.riskLevel ?? [];
  const insights = raw.insights ?? {};
  const totalDocuments = riskLevel.reduce((s: number, t: RiskTrendData) => s + (t.total || 0), 0);
  const trendPercentage = riskLevel.length >= 2
    ? Math.round(
        Math.abs(
          ((riskLevel[riskLevel.length - 1].critical * 3 + riskLevel[riskLevel.length - 1].warning * 2 + riskLevel[riskLevel.length - 1].normal) /
            (riskLevel[riskLevel.length - 1].total || 1)) -
          ((riskLevel[0].critical * 3 + riskLevel[0].warning * 2 + riskLevel[0].normal) / (riskLevel[0].total || 1))
        ) * 50
      )
    : 0;
  const withScore: RiskTrendData[] = riskLevel.map((t: RiskTrendData) => ({
    ...t,
    riskScore: t.total ? (t.critical * 3 + t.warning * 2 + t.normal) / t.total : 0,
  }));
  const peak = withScore.length
    ? withScore.reduce((max, t) => ((t.riskScore ?? 0) > (max.riskScore ?? 0) ? t : max), withScore[0])
    : null;

  return {
    period: raw.period ?? { start: '', end: '', days: 0 },
    riskLevelTrends: withScore,
    summary: {
      totalDocuments,
      averageRiskScore: Math.round(Number(insights.averageRiskScore ?? 0) * 10) / 10,
      peakRiskDate: peak?.date ?? insights.peakRiskDate ?? '—',
      peakRiskScore: peak?.riskScore != null ? Math.round(peak.riskScore * 10) / 10 : 0,
      trendDirection: insights.overallTrend ?? 'stable',
      trendPercentage,
    },
  };
}

export default function RiskTrendsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('week');
  const [chartType, setChartType] = useState<'stacked' | 'area' | 'line'>('stacked');

  useEffect(() => {
    loadDashboard();
  }, [groupBy]);

  const loadDashboard = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const response = await apiClient.get('/api/analytics/trends', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          groupBy,
        },
      });
      const mapped = mapAnalyticsToDashboard(response.data);
      setData(mapped);
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

  const chartData = data.riskLevelTrends.map((t) => ({
    date: t.date,
    Critical: t.critical,
    Warning: t.warning,
    Normal: t.normal,
    Total: t.total,
    riskScore: Number(t.riskScore ?? 0),
  }));

  return (
    <div className="risk-trends-dashboard">
      <div className="dashboard-header">
        <h2>📊 Risk Trends Dashboard</h2>
        <div className="controls">
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}>
            <option value="day">By Day</option>
            <option value="week">By Week</option>
            <option value="month">By Month</option>
          </select>
          <select value={chartType} onChange={(e) => setChartType(e.target.value as 'stacked' | 'area' | 'line')}>
            <option value="stacked">Stacked Bar</option>
            <option value="area">Area</option>
            <option value="line">Line</option>
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
            {data.summary.trendPercentage}%
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Peak Risk Date</div>
          <div className="value">{String(data.summary.peakRiskDate)}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Risk Level Trends</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={340}>
            {chartType === 'stacked' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Critical" stackId="a" fill={CRITICAL_COLOR} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Warning" stackId="a" fill={WARNING_COLOR} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Normal" stackId="a" fill={NORMAL_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Critical" stackId="1" stroke={CRITICAL_COLOR} fill={CRITICAL_COLOR} fillOpacity={0.7} />
                <Area type="monotone" dataKey="Warning" stackId="1" stroke={WARNING_COLOR} fill={WARNING_COLOR} fillOpacity={0.7} />
                <Area type="monotone" dataKey="Normal" stackId="1" stroke={NORMAL_COLOR} fill={NORMAL_COLOR} fillOpacity={0.7} />
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 3]} />
                <Tooltip formatter={(v: number) => [Number(v).toFixed(1), 'Risk Score']} />
                <Legend />
                <Line type="monotone" dataKey="riskScore" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Risk Score" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
