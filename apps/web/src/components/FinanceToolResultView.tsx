import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { FinanceToolResult, FinanceToolChart } from '../api/client';
import './FinanceToolResultView.css';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface FinanceToolResultViewProps {
  result: FinanceToolResult;
  onClose: () => void;
  onExportPdf?: () => void;
}

function ChartBlock({ chart }: { chart: FinanceToolChart }) {
  const hasValues = (chart.values && chart.values.length > 0) || (chart.datasets?.some((d) => d.values?.length));
  if (!hasValues || !chart.labels?.length) return null;

  const singleSeries = chart.values && chart.values.length > 0;
  const data = singleSeries
    ? chart.labels.map((label, i) => ({ name: label, value: chart.values![i] ?? 0 }))
    : chart.labels.map((_, i) => {
        const point: Record<string, string | number> = { name: chart.labels[i] ?? `Item ${i}` };
        chart.datasets?.forEach((ds, di) => {
          point[ds.label] = ds.values[i] ?? 0;
        });
        return point;
      });

  const renderChart = () => {
    switch (chart.type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-medium, #e2e8f0)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {singleSeries ? (
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
              ) : (
                chart.datasets?.map((ds, i) => (
                  <Line
                    key={ds.label}
                    type="monotone"
                    dataKey={ds.label}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-medium, #e2e8f0)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {singleSeries ? (
                <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.4} />
              ) : (
                chart.datasets?.map((ds, i) => (
                  <Area
                    key={ds.label}
                    type="monotone"
                    dataKey={ds.label}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.4}
                  />
                ))
              )}
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-medium, #e2e8f0)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {singleSeries ? (
                <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              ) : (
                chart.datasets?.map((ds, i) => (
                  <Bar
                    key={ds.label}
                    dataKey={ds.label}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))
              )}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="finance-result-view-chart">
      <h4 className="finance-result-view-chart-title">{chart.title}</h4>
      {renderChart()}
    </div>
  );
}

export default function FinanceToolResultView({ result, onClose, onExportPdf }: FinanceToolResultViewProps) {
  return (
    <div className="finance-result-view-overlay" onClick={onClose}>
      <div className="finance-result-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="finance-result-view-header">
          <h2>{result.title}</h2>
          <div className="finance-result-view-actions">
            {onExportPdf && (
              <button type="button" className="finance-result-view-export" onClick={onExportPdf}>
                Export PDF
              </button>
            )}
            <button type="button" className="finance-result-view-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        <div className="finance-result-view-body">
          {result.error && <p className="finance-result-view-error">{result.error}</p>}
          {result.youAreSafe && (
            <div className="finance-result-view-you-are-safe">
              <strong>You are safe.</strong> No tax liability / no action required.
              {result.nextCheckSuggested && ` Next check: ${result.nextCheckSuggested}`}
            </div>
          )}
          {result.summary && <p className="finance-result-view-summary">{result.summary}</p>}

          {result.charts && result.charts.length > 0 && (
            <section className="finance-result-view-charts">
              <h3>Charts &amp; graphs</h3>
              <div className="finance-result-view-charts-grid">
                {result.charts.map((chart, i) => (
                  <ChartBlock key={i} chart={chart} />
                ))}
              </div>
            </section>
          )}

          <section className="finance-result-view-sections">
            <h3>Details &amp; calculations</h3>
            {result.sections?.map((s, i) => (
              <div key={i} className="finance-result-view-section">
                <h4>{s.heading}</h4>
                {s.content && <p>{s.content}</p>}
                {s.items?.length ? (
                  <ul>
                    {s.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
