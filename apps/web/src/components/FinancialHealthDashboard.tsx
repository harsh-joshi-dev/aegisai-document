import { useState, useEffect } from 'react';
import { getDashboardHealth, type DashboardHealthSummary, type DashboardRiskLevel } from '../api/client';
import ServiceProviderModal from './ServiceProviderModal';
import './FinancialHealthDashboard.css';

export default function FinancialHealthDashboard() {
  const [summary, setSummary] = useState<DashboardHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCA, setShowCA] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDashboardHealth()
      .then((res) => {
        if (!cancelled) setSummary(res.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading || !summary) return null;
  if (summary.totalDocuments === 0) return null;

  const riskColor: Record<DashboardRiskLevel, string> = {
    Green: '#10b981',
    Yellow: '#f59e0b',
    Red: '#ef4444',
  };

  return (
    <>
      <div className="financial-health-dashboard">
        <div className="financial-health-header">
          <h3>Financial Health</h3>
          <span
            className="financial-health-badge"
            style={{ background: riskColor[summary.riskLevel], color: '#fff' }}
          >
            {summary.riskLevel}
          </span>
        </div>
        <div className="financial-health-counts">
          <span title="Critical documents">🔴 {summary.criticalCount}</span>
          <span title="Warning documents">🟡 {summary.warningCount}</span>
          <span title="Normal documents">🟢 {summary.normalCount}</span>
        </div>
        {summary.youAreSafe && (
          <p className="financial-health-safe">
            ✓ You are safe. No tax liability or critical issues. Next check: end of quarter.
          </p>
        )}
        {!summary.youAreSafe && <p className="financial-health-message">{summary.message}</p>}
        {summary.suggestExpert && (
          <button type="button" className="financial-health-cta" onClick={() => setShowCA(true)}>
            Find CA / Tax Expert nearby
          </button>
        )}
      </div>
      {showCA && (
        <ServiceProviderModal
          category="Financial"
          riskExplanation="Tax or compliance support"
          isOpen={showCA}
          onClose={() => setShowCA(false)}
        />
      )}
    </>
  );
}
