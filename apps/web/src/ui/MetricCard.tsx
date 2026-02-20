import { ReactNode } from 'react';
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

const palette: Record<string, { icon: string; iconBg: string; border: string }> = {
  indigo: { icon: '#818cf8', iconBg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.2)' },
  emerald: { icon: '#34d399', iconBg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.2)' },
  amber: { icon: '#fbbf24', iconBg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)' },
  rose: { icon: '#fb7185', iconBg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)' },
  sky: { icon: '#38bdf8', iconBg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.2)' },
};

export function MetricCard({
  title,
  value,
  description,
  trend,
  icon,
  color = 'indigo',
}: {
  title: string;
  value: string | number;
  description?: string;
  trend?: { value: string; positive: boolean };
  icon?: ReactNode;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
}) {
  const c = palette[color] ?? palette.indigo;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '16px',
        padding: '24px',
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '18px' }}>
        <div
          style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: c.iconBg, border: `1px solid ${c.border}`,
            color: c.icon,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {icon || <ArrowUpRight size={18} />}
        </div>
        {trend && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '20px',
              fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
              color: trend.positive ? '#34d399' : '#fb7185',
              background: trend.positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${trend.positive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            {trend.positive ? <TrendingUp size={11} style={{ flexShrink: 0 }} /> : <TrendingDown size={11} style={{ flexShrink: 0 }} />}
            {trend.value}
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>
        {title}
      </p>

      {/* Value */}
      <p style={{ fontSize: '30px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.025em', lineHeight: 1.1, fontFamily: "'Outfit', system-ui, sans-serif", margin: 0 }}>
        {value}
      </p>

      {/* Description */}
      {description && (
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '12px', lineHeight: 1.4 }}>
          {description}
        </p>
      )}
    </div>
  );
}
