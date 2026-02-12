/**
 * India SME Lending - INR pricing model
 * Pay-per-use ₹149/loan file; Monthly cap ₹4,999; DPDP add-on ₹999/mo
 */
import { Router, Request, Response } from 'express';

const router = Router();

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

const INDIA_PLANS: PricingPlan[] = [
  {
    id: 'pay_per_use',
    name: 'Pay per loan file',
    currency: 'INR',
    amount: 149,
    interval: 'one_time',
    description: 'Per loan file analyzed (GST/ITR/Bank consistency)',
    features: [
      'One loan file analysis',
      'ULI document fetch (with consent)',
      'Consistency score & risk flags',
      'Due diligence report',
    ],
  },
  {
    id: 'monthly_cap',
    name: 'Unlimited analysis',
    currency: 'INR',
    amount: 4999,
    interval: 'month',
    description: 'For microfinance institutions & NBFCs',
    features: [
      'Unlimited loan file analysis',
      'ULI integration',
      'Consistency rules & reports',
      'Priority processing',
    ],
  },
  {
    id: 'dpdp_addon',
    name: 'DPDP Compliance add-on',
    currency: 'INR',
    amount: 999,
    interval: 'month',
    description: 'Automated audit trail generation',
    features: [
      'Immutable consent logs',
      'Data principal rights tracking',
      'Auto-deletion scheduler',
      'Transfer-blocker checks',
    ],
    addOn: true,
  },
];

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    currency: 'INR',
    locale: 'en-IN',
    plans: INDIA_PLANS,
    note: 'India SME Lending Intelligence Platform. All prices in ₹ (INR).',
  });
});

export default router;
