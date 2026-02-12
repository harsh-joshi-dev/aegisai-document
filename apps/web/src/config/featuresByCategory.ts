/**
 * Business categories and their features for the header mega-menu.
 * - type: 'page' → navigate to path
 * - type: 'feature' → go to Upload with ?feature=id and use feature runner (document picker + Run)
 */
export type FeatureType = 'page' | 'feature';

export interface NavFeature {
  id: string;
  label: string;
  type: FeatureType;
  /** For type 'page': path. For type 'feature': same as id (used in ?feature=). */
  path?: string;
}

export interface NavCategory {
  id: string;
  label: string;
  features: NavFeature[];
}

export const featuresByCategory: NavCategory[] = [
  {
    id: 'legal',
    label: 'Legal',
    features: [
      { id: 'what-next', label: 'What Should I Do Next?', type: 'feature' },
      { id: 'explain', label: 'Explain Document', type: 'feature' },
      { id: 'drafts', label: 'Generate Drafts (Reply / Appeal)', type: 'feature' },
      { id: 'negotiation', label: 'Negotiation Simulator', type: 'feature' },
      { id: 'risk-clauses', label: 'Why Is This Risky?', type: 'feature' },
      { id: 'policy-matcher', label: 'Policy & Contract Matcher', type: 'feature' },
      { id: 'trust-score', label: 'Trust Score', type: 'feature' },
      { id: 'share-summary', label: 'Share Safe Summary', type: 'feature' },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    features: [
      { id: 'financial-impact', label: 'Financial Impact Estimator', type: 'feature' },
      { id: 'deadlines', label: 'Deadlines & Reminders', type: 'feature' },
      { id: 'dashboard', label: 'Dashboard', type: 'page', path: '/dashboard' },
    ],
  },
  {
    id: 'sme-lending',
    label: 'SME Lending (India)',
    features: [
      { id: 'loan-applications', label: 'Loan Applications (ULI)', type: 'page', path: '/' },
      { id: 'financial-consistency', label: 'Financial Consistency Report', type: 'feature' },
      { id: 'due-diligence', label: 'Due Diligence Report (NBFC)', type: 'feature' },
      { id: 'dpdp-compliance', label: 'DPDP Consent & Rights', type: 'page', path: '/' },
      { id: 'pricing', label: 'Pricing (INR)', type: 'page', path: '/pricing' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    features: [
      { id: 'policy-matcher', label: 'Policy Matcher', type: 'feature' },
      { id: 'risk-clauses', label: 'Risk Breakdown', type: 'feature' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents & Workflow',
    features: [
      { id: 'upload', label: 'Upload Documents', type: 'page', path: '/' },
      { id: 'chat', label: 'Chat with Documents', type: 'page', path: '/chat' },
      { id: 'deadlines', label: 'Deadlines', type: 'feature' },
      { id: 'comments', label: 'Comments & Notes', type: 'feature' },
      { id: 'completeness', label: 'Completeness Check', type: 'feature' },
      { id: 'verify', label: 'Verify Document', type: 'feature' },
    ],
  },
  {
    id: 'trust',
    label: 'Trust & Safety',
    features: [
      { id: 'trust-score', label: 'Trust Score', type: 'feature' },
      { id: 'scam-score', label: 'Scam / Fraud Score', type: 'feature' },
      { id: 'share-summary', label: 'Share Safe Summary', type: 'feature' },
      { id: 'risk-clauses', label: 'Why Risky?', type: 'feature' },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    features: [
      { id: 'chat', label: 'Role-Based Views (Chat)', type: 'page', path: '/chat' },
      { id: 'comments', label: 'Internal Comments', type: 'feature' },
      { id: 'policy-matcher', label: 'Policy Matcher', type: 'feature' },
      { id: 'dashboard', label: 'Compliance Dashboard', type: 'page', path: '/dashboard' },
    ],
  },
];

/** All feature ids that require a document (runner on Upload page). */
export const documentScopedFeatureIds = new Set(
  featuresByCategory.flatMap((c) => c.features).filter((f) => f.type === 'feature').map((f) => f.id)
);

/** Get display label for a feature id (first match in categories). */
export function getFeatureLabel(featureId: string): string {
  for (const cat of featuresByCategory) {
    const f = cat.features.find((x) => x.id === featureId);
    if (f) return f.label;
  }
  return featureId;
}
