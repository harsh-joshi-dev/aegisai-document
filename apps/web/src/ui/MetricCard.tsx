import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

export function MetricCard({
  title,
  value,
  description,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  description?: string;
  helper?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[20px] bg-[#0e0e11] border border-white/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/10 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      {/* Glow Effect */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl transition-all duration-500 group-hover:bg-indigo-500/10" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors duration-300">
            {icon || <ArrowUpRight size={20} />}
          </div>
          {helper && (
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {helper}
            </span>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-400 mb-1">{title}</p>
          <h3 className="font-display text-3xl font-bold text-white tracking-tight">{value}</h3>
          {description && (
            <p className="mt-2 text-xs text-zinc-500 line-clamp-1 group-hover:text-zinc-400 transition-colors">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
