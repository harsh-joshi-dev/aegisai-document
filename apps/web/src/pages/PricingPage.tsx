import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { formatINR } from '../utils/formatINR';
import '../index.css';

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
        setPlans([
          { id: 'pay_per_use', name: 'Pay per loan file', currency: 'INR', amount: 149, interval: 'one_time', description: 'Per loan file analyzed (GST/ITR/Bank consistency)', features: ['One loan file analysis', 'ULI document fetch (with consent)', 'Consistency score & risk flags', 'Due diligence report'] },
          { id: 'monthly_cap', name: 'Unlimited analysis', currency: 'INR', amount: 4999, interval: 'month', description: 'For microfinance institutions & NBFCs', features: ['Unlimited loan file analysis', 'ULI integration', 'Consistency rules & reports', 'Priority processing'] },
          { id: 'dpdp_addon', name: 'DPDP Compliance add-on', currency: 'INR', amount: 999, interval: 'month', description: 'Automated audit trail generation', features: ['Immutable consent logs', 'Data principal rights tracking', 'Auto-deletion scheduler', 'Transfer-blocker checks'], addOn: true },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const displayPlans = plans.length > 0 ? plans : [
    { id: 'pay_per_use', name: 'Pay per loan file', currency: 'INR' as const, amount: 149, interval: 'one_time' as const, description: 'Per loan file analyzed (GST/ITR/Bank consistency)', features: ['One loan file analysis', 'ULI document fetch (with consent)', 'Consistency score & risk flags', 'Due diligence report'], addOn: false },
    { id: 'monthly_cap', name: 'Unlimited analysis', currency: 'INR' as const, amount: 4999, interval: 'month' as const, description: 'For microfinance institutions & NBFCs', features: ['Unlimited loan file analysis', 'ULI integration', 'Consistency rules & reports', 'Priority processing'], addOn: false },
    { id: 'dpdp_addon', name: 'DPDP Compliance add-on', currency: 'INR' as const, amount: 999, interval: 'month' as const, description: 'Automated audit trail generation', features: ['Immutable consent logs', 'Data principal rights tracking', 'Auto-deletion scheduler', 'Transfer-blocker checks'], addOn: true },
  ];

  return (
    <div className="min-h-screen bg-main pt-24 pb-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6">
            India SME Lending — Transparent Pricing
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            ULI-integrated, DPDP-compliant loan analysis. All prices in ₹ (INR). No hidden fees.
          </p>
        </div>

        {loading ? (
          <div className="text-center text-muted py-12">Loading plans...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayPlans.map((plan) => (
              <div
                key={plan.id}
                className={`glass-panel p-8 relative overflow-hidden group hover:bg-card-hover transition-all duration-300 ${plan.addOn ? '' : plan.id === 'monthly_cap' ? 'border-primary/50 shadow-glow transform md:-translate-y-4' : ''}`}
              >
                {plan.id === 'monthly_cap' && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                )}
                {plan.addOn && (
                  <div className="absolute top-0 right-0 bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">ADD-ON</div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold mb-6">
                  {plan.interval === 'one_time' ? formatINR(plan.amount) : `${formatINR(plan.amount)}`}
                  <span className="text-lg text-muted font-normal">
                    {plan.interval === 'one_time' ? '/ file' : '/mo'}
                  </span>
                </div>
                <p className="text-muted mb-8 h-12">{plan.description}</p>
                <ul className="mb-8 space-y-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-success">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.addOn ? '/contact' : '/login'}
                  className="w-full btn block text-center border border-light hover:border-primary"
                >
                  {plan.addOn ? 'Contact for add-on' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>
        )}
        <p className="text-center text-muted mt-8 text-sm">
          All data processed in India. DPDP-compliant consent logging and 90-day retention.
        </p>
      </div>
    </div>
  );
}
