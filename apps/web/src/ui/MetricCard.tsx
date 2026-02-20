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
      className="relative rounded-2xl p-6 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 group"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Premium background effects */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${c.iconBg}, transparent 70%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500" style={{ color: c.icon }} />

      <div className="flex items-center justify-between gap-2 mb-6 relative">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110"
          style={{ background: c.iconBg, border: `1px solid ${c.border}`, color: c.icon }}
        >
          {icon || <ArrowUpRight size={20} />}
        </div>
        {trend && (
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
            style={{
              color: trend.positive ? 'var(--success)' : 'var(--danger)',
              background: trend.positive ? 'var(--success-dim, rgba(16,185,129,0.1))' : 'var(--danger-dim, rgba(239,68,68,0.1))',
              border: `1px solid ${trend.positive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            {trend.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend.value}
          </span>
        )}
      </div>

      <div className="relative">
        <p className="text-3xl font-extrabold tracking-tight leading-none font-display text-[var(--text-main)]">
          {value}
        </p>
        <p className="text-xs font-bold text-[var(--text-muted)] mt-2 uppercase tracking-widest opacity-80">
          {title}
        </p>
        {description && (
          <p className="text-[11px] text-[var(--text-dim)] mt-3 leading-relaxed font-medium">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
