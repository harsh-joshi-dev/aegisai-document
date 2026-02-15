import { RiskLevel } from '../mock/types';

const riskStyles: Record<RiskLevel, string> = {
  Safe: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
  'Review Required': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.2)]',
  Critical: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse',
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${riskStyles[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}
