import { ReactNode } from 'react';
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

const palette: Record<string, { icon: string; iconBg: string; border: string }> = {
  indigo: { icon: '#818cf8', iconBg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.15)' },
  emerald: { icon: '#34d399', iconBg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.15)' },
  amber: { icon: '#fbbf24', iconBg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.15)' },
  rose: { icon: '#fb7185', iconBg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.15)' },
  sky: { icon: '#38bdf8', iconBg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.15)' },
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
      className="relative rounded-2xl p-6 overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 group"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      {/* Subtle gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}
      />

      {/* Top row */}
      <div className="flex items-center justify-between gap-2 mb-5 relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: c.iconBg, border: `1px solid ${c.border}`, color: c.icon }}
        >
          {icon || <ArrowUpRight size={18} />}
        </div>
        {trend && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
            style={{
              color: trend.positive ? '#34d399' : '#fb7185',
              background: trend.positive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${trend.positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}
          >
            {trend.positive ? <TrendingUp size={11} className="shrink-0" /> : <TrendingDown size={11} className="shrink-0" />}
            {trend.value}
          </span>
        )}
      </div>

      {/* Value */}
      <p className="text-[28px] font-extrabold tracking-tight leading-none font-display text-main relative">
        {value}
      </p>

      {/* Title */}
      <p className="text-sm font-medium text-muted mt-2 relative">
        {title}
      </p>

      {/* Description */}
      {description && (
        <p className="text-xs text-dim mt-2.5 leading-relaxed relative">
          {description}
        </p>
      )}
    </div>
  );
}
