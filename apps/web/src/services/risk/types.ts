/**
 * Risk Engine Types – CA.Dynamix Decision Workspace
 * Unified risk signal and result models.
 */

export type RiskSignalType = 'RULE' | 'PATTERN' | 'AI';

export type RiskSignalSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskImpact = 'financial' | 'compliance' | 'fraud';

export type SuggestedAction = 'approve' | 'hold' | 'reject' | 'verify';

export interface RiskSignalMetadata {
  evidence: string[];
  fields: string[];
  documentIds: string[];
}

export interface StructuredRecommendation {
  action: SuggestedAction;
  reason: string;
  priority: number;
}

export interface RiskSignal {
  id: string;
  documentId: string;
  tenantId: string;
  type: RiskSignalType;
  subtype?: string;
  severity: RiskSignalSeverity;
  confidence: number;
  weight: number;
  explanation: string;
  recommendation: StructuredRecommendation | string; // Support both new and legacy formats
  impact: RiskImpact;
  evidence: string[];
  suggestedAction: SuggestedAction;
  metadata: RiskSignalMetadata;
  createdAt: string;
  /** Optional: field for consistency/mismatch signals */
  field?: string;
  /** Optional: source A for comparison */
  sourceA?: string;
  /** Optional: source B for comparison */
  sourceB?: string;
  /** Legacy fields for backward compatibility */
  title?: string;
  description?: string;
  confidenceScore?: number;
}

export type RiskLevel = 'SAFE' | 'REVIEW' | 'HIGH' | 'CRITICAL';

export interface RiskResult {
  documentId: string;
  tenantId: string;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  /** Computed from signals */
  recommendations: string[];
  createdAt: string;
}

/** Severity → numeric weight for score aggregation */
export const SEVERITY_WEIGHT: Record<RiskSignalSeverity, number> = {
  LOW: 10,
  MEDIUM: 25,
  HIGH: 50,
  CRITICAL: 80,
};

/** Score → Risk Level mapping (0–100) */
export const SCORE_TO_LEVEL = (
  score: number
): RiskLevel => {
  if (score <= 25) return 'SAFE';
  if (score <= 50) return 'REVIEW';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
};
