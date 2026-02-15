import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { formatINR } from '../utils/formatINR';
import { ArrowLeft, Check, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

export interface PricingPlan {
  id: string;
  name: string;
  currency: 'INR';
  amount: number;
  interval: 'one_time' | 'month';
  description: string;
  features: string[];
  addOn?: boolean;
}

const fallbackPlans: PricingPlan[] = [
  { id: 'pay_per_use', name: 'Pay per loan file', currency: 'INR', amount: 149, interval: 'one_time', description: 'Per loan file analyzed (GST/ITR/Bank consistency)', features: ['One loan file analysis', 'ULI document fetch (with consent)', 'Consistency score & risk flags', 'Due diligence report'] },
  { id: 'monthly_cap', name: 'Unlimited analysis', currency: 'INR', amount: 4999, interval: 'month', description: 'For microfinance institutions & NBFCs', features: ['Unlimited loan file analysis', 'ULI integration', 'Consistency rules & reports', 'Priority processing'] },
  { id: 'dpdp_addon', name: 'DPDP Compliance add-on', currency: 'INR', amount: 999, interval: 'month', description: 'Automated audit trail generation', features: ['Immutable consent logs', 'Data principal rights tracking', 'Auto-deletion scheduler', 'Transfer-blocker checks'], addOn: true },
];

const planIcons: Record<string, typeof Zap> = {
  pay_per_use: Zap,
  monthly_cap: Sparkles,
  dpdp_addon: Shield,
};

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ success: boolean; plans: PricingPlan[]; currency: string }>('/api/pricing')
      .then((res) => {
        if (res.data.success && res.data.plans?.length) setPlans(res.data.plans);
      })
      .catch(() => {
        setPlans(fallbackPlans);
      })
      .finally(() => setLoading(false));
  }, []);

  const displayPlans = plans.length > 0 ? plans : fallbackPlans;

  return (
    <div className="min-h-screen bg-[#030304] text-white font-sans relative overflow-hidden selection:bg-indigo-500/30">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[200px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030304]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <Link to="/auth" className="btn-primary h-9 px-5 text-sm shadow-lg shadow-indigo-500/20">
            Get Started <ArrowRight size={14} className="ml-1" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto pt-32 pb-20 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-xs font-medium text-zinc-400 mb-6">
            <Sparkles size={14} className="text-indigo-400" />
            No hidden fees · All prices in INR
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-white tracking-tight">
            Transparent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Pricing
            </span>
          </h1>
          <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
            ULI-integrated, DPDP-compliant loan analysis. Pay per file or go unlimited.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 text-zinc-400">
              <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full" />
              Loading plans…
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {displayPlans.map((plan) => {
              const isPopular = plan.id === 'monthly_cap';
              const isAddOn = !!plan.addOn;
              const PlanIcon = planIcons[plan.id] || Zap;

              return (
                <div
                  key={plan.id}
                  className={`
                    relative rounded-[20px] border p-8 transition-all duration-300
                    ${isPopular
                      ? 'bg-gradient-to-b from-indigo-500/5 to-[#0e0e11] border-indigo-500/30 shadow-[0_0_60px_rgba(99,102,241,0.15)] md:-translate-y-4 md:scale-105'
                      : 'bg-[#0e0e11] border-white/5 hover:border-white/10'
                    }
                    ${isAddOn ? 'border-dashed border-amber-500/30' : ''}
                  `}
                >
                  {/* Badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-lg shadow-indigo-500/30">
                      MOST POPULAR
                    </div>
                  )}
                  {isAddOn && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-500 text-xs font-bold text-black shadow-lg">
                      ADD-ON
                    </div>
                  )}

                  {/* Icon & Title */}
                  <div className="flex items-center gap-3 mb-6 mt-2">
                    <div className={`p-2.5 rounded-xl ${isPopular ? 'bg-indigo-500/10 text-indigo-400' : isAddOn ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-zinc-400'}`}>
                      <PlanIcon size={22} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="font-display text-4xl font-bold text-white">{formatINR(plan.amount)}</span>
                    <span className="text-sm text-zinc-500 ml-1.5">
                      {plan.interval === 'one_time' ? '/ file' : '/month'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-8 leading-relaxed">{plan.description}</p>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isPopular ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-emerald-400'}`}>
                          <Check size={10} strokeWidth={3} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    to={isAddOn ? '/contact' : '/auth'}
                    className={`
                      block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all
                      ${isPopular
                        ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20'
                        : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20'
                      }
                    `}
                  >
                    {isAddOn ? 'Contact for Add-on' : 'Get Started'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-zinc-500 mt-12 text-xs">
          All data processed in India. DPDP-compliant consent logging and 90-day retention.
        </p>
      </main>
    </div>
  );
}
