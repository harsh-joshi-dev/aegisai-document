/**
 * ULI + DPDP only — single product sector.
 */
export type FeatureType = 'page' | 'feature';

export interface NavFeature {
  id: string;
  label: string;
  type: FeatureType;
  path?: string;
}

export interface NavCategory {
  id: string;
  label: string;
  features: NavFeature[];
}

export const featuresByCategory: NavCategory[] = [
  {
    id: 'uli-dpdp',
    label: 'ULI & DPDP',
    features: [
      { id: 'upload', label: 'Upload Loan Documents', type: 'page', path: '/' },
      { id: 'loan-applications', label: 'Loan Applications (ULI)', type: 'page', path: '/' },
      { id: 'financial-consistency', label: 'Financial Consistency Report', type: 'feature' },
      { id: 'due-diligence', label: 'Due Diligence Report (NBFC)', type: 'feature' },
      { id: 'dpdp-compliance', label: 'DPDP Consent & Rights', type: 'page', path: '/' },
      { id: 'pricing', label: 'Pricing (INR)', type: 'page', path: '/pricing' },
    ],
  },
];

export const documentScopedFeatureIds = new Set(
  featuresByCategory.flatMap((c) => c.features).filter((f) => f.type === 'feature').map((f) => f.id)
);

export function getFeatureLabel(featureId: string): string {
  for (const cat of featuresByCategory) {
    const f = cat.features.find((x) => x.id === featureId);
    if (f) return f.label;
  }
  return featureId;
}
