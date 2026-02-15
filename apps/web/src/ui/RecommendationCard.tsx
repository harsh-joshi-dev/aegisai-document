export function RecommendationCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 hover:bg-emerald-500/15 transition-colors">
      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
      <p className="text-sm text-emerald-300 leading-relaxed">{text}</p>
    </div>
  );
}
