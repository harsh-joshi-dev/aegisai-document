import { FormEvent, useState } from 'react';
import { RuleRecord } from '../mock/types';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { ShieldCheck, Plus, Zap, FileCheck, GitCompare, AlertTriangle } from 'lucide-react';

const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
  Low: { color: 'text-muted', bg: 'bg-subtle', border: 'border-subtle' },
  Medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  High: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  Critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const typeIcons: Record<string, typeof Zap> = {
  Threshold: Zap,
  'Required Field': FileCheck,
  Consistency: GitCompare,
};

export default function RulesPage() {
  const { rules, addRule } = useStore();
  const { push } = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<RuleRecord['type']>('Threshold');
  const [config, setConfig] = useState('');
  const [severity, setSeverity] = useState<RuleRecord['severity']>('Medium');
  const [weight, setWeight] = useState(10);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const rule: RuleRecord = {
      id: `rule-${Date.now()}`,
      name,
      type,
      config,
      severity,
      weight,
    };
    addRule(rule);
    push({ kind: 'success', title: 'Rule created', message: rule.name });
    setName('');
    setConfig('');
    setWeight(10);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-subtle pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-main tracking-tight">Rules Engine</h1>
          <p className="mt-2 text-sm text-muted max-w-xl">
            Define detection policies — thresholds, required fields, and cross-document consistency checks.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted bg-card px-3 py-1.5 rounded-full border border-subtle">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span className="font-bold text-main">{rules.length}</span> active rules
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Rules List */}
        <section className="space-y-3">
          {rules.map((r) => {
            const sc = severityConfig[r.severity] || severityConfig.Medium;
            const TypeIcon = typeIcons[r.type] || Zap;
            return (
              <div key={r.id} className="card-premium p-5 group hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-subtle text-muted group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5">
                      <TypeIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-main group-hover:text-indigo-300 transition-colors">{r.name}</h3>
                      <p className="text-xs text-dim mt-1 font-mono">{r.config}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sc.color} ${sc.bg} ${sc.border}`}>
                      {r.severity}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-subtle">
                  <div className="flex items-center gap-4 text-xs text-dim">
                    <span>Type: <span className="text-main font-medium">{r.type}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-dim">Weight</span>
                    <div className="w-24 h-1.5 rounded-full bg-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                        style={{ width: `${r.weight}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted w-8 text-right">{r.weight}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {rules.length === 0 && (
            <div className="card-premium py-20 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-subtle flex items-center justify-center mb-6">
                <AlertTriangle className="text-dim" size={32} />
              </div>
              <p className="text-lg font-bold text-main">No rules configured</p>
              <p className="text-sm text-muted mt-2 max-w-[280px]">Create your first detection rule to automate audit policies.</p>
            </div>
          )}
        </section>

        {/* Create Rule Form */}
        <section className="card-premium h-fit xl:sticky xl:top-28">
          <div className="p-6 border-b border-subtle flex items-center gap-3 bg-emerald-500/[0.02]">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-main">New Rule</h3>
              <p className="text-xs text-muted">Add detection logic to the risk engine</p>
            </div>
          </div>
          <div className="p-6">
            <form className="space-y-5" onSubmit={onCreate}>
              <div>
                <label className="mb-2 block text-xs font-medium text-dim uppercase tracking-wide">Rule Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Max invoice threshold"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-dim uppercase tracking-wide">Type</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none cursor-pointer"
                    value={type}
                    onChange={(e) => setType(e.target.value as RuleRecord['type'])}
                  >
                    <option value="Threshold">Threshold</option>
                    <option value="Required Field">Required Field</option>
                    <option value="Consistency">Consistency Check</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dim">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted uppercase tracking-wide">Configuration</label>
                <textarea
                  className="input-field min-h-[100px] resize-y"
                  placeholder="e.g. amount > 50000"
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted uppercase tracking-wide">Severity</label>
                  <div className="relative">
                    <select
                      className="input-field appearance-none cursor-pointer"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as RuleRecord['severity'])}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted uppercase tracking-wide">Weight (1–100)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    min={1}
                    max={100}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full h-11 text-sm shadow-lg shadow-indigo-500/20">
                <Plus size={16} className="mr-2" />
                Create Rule
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
