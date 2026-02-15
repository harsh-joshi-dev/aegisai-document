/**
 * Risk Signal Types - Unified Risk Intelligence System
 * All detections emit standardized RiskSignals
 */

export type RiskSignalType = 'rule_violation' | 'pattern' | 'mismatch' | 'missing_field' | 'anomaly';
export type RiskSignalSubtype = 
  | 'threshold_exceeded' 
  | 'gst_missing' 
  | 'amount_mismatch' 
  | 'repeated_amount'
  | 'vendor_frequency_spike'
  | 'round_number_payment'
  | 'rapid_transactions'
  | 'required_field_missing'
  | 'consistency_check_failed'
  | 'time_rule_violation';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Recommendation {
  action_type: 'verify' | 'review' | 'reject' | 'request_info' | 'none';
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskSignal {
  id: string;
  tenant_id: string;
  document_id: string | null;
  type: RiskSignalType;
  subtype: RiskSignalSubtype | string;
  severity: Severity;
  confidence: number; // 0-1
  weight: number;
  explanation: string;
  recommendation: Recommendation;
  metadata: Record<string, any>;
  created_at: string;
}

export interface RiskSignalInput {
  tenant_id: string;
  document_id: string | null;
  type: RiskSignalType;
  subtype: RiskSignalSubtype | string;
  severity: Severity;
  confidence: number;
  weight: number;
  explanation: string;
  recommendation: Recommendation;
  metadata?: Record<string, any>;
}

// Rule Engine V2 Types
export type RuleType = 'threshold' | 'required' | 'consistency' | 'time';

export interface DynamicRule {
  id: string;
  tenant_id: string;
  name: string;
  rule_type: RuleType;
  config: RuleConfig;
  severity: Severity;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RuleConfig = 
  | ThresholdRuleConfig 
  | RequiredFieldRuleConfig 
  | ConsistencyRuleConfig 
  | TimeRuleConfig;

export interface ThresholdRuleConfig {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
  value: number;
  unit?: string;
}

export interface RequiredFieldRuleConfig {
  field: string;
  allow_empty?: boolean;
}

export interface ConsistencyRuleConfig {
  fields: string[];
  tolerance: number; // percentage
  comparison_type?: 'exact' | 'percentage' | 'absolute';
}

export interface TimeRuleConfig {
  max_gap_days: number;
  field?: string;
  reference_date?: 'today' | 'document_date' | 'upload_date';
}

// Risk Result Types
export interface RiskResult {
  id: string;
  tenant_id: string;
  document_id: string;
  risk_score: number; // 0-100
  risk_level: 'safe' | 'review' | 'high' | 'critical';
  factors: RiskSignal[];
  summary: string;
  recommendations: Recommendation[];
  created_at: string;
  updated_at: string;
}

// Pattern Detection Types
export interface PatternDetectionInput {
  tenant_id: string;
  document_id: string;
  extracted_data: Record<string, any>;
  timestamp: string;
}

export interface CrossDocumentPattern {
  pattern_type: string;
  severity: Severity;
  confidence: number;
  affected_document_ids: string[];
  explanation: string;
  recommendation: Recommendation;
  metadata: Record<string, any>;
}

// Severity weights for scoring
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// Risk level bands
export const RISK_LEVEL_BANDS = {
  safe: { min: 0, max: 30, label: 'safe' },
  review: { min: 31, max: 60, label: 'review' },
  high: { min: 61, max: 80, label: 'high' },
  critical: { min: 81, max: 100, label: 'critical' },
} as const;
