/**
 * Rule Execution Engine V2
 * Executes dynamic rules against document data and emits RiskSignals
 */

import type { 
  DynamicRule, 
  RiskSignalInput, 
  ThresholdRuleConfig,
  RequiredFieldRuleConfig,
  ConsistencyRuleConfig,
  TimeRuleConfig,
  Recommendation,
  Severity
} from './types.js';

const DEFAULT_RULESET_VERSION = '2026.02.28';
const DEFAULT_RULESET_EFFECTIVE_FROM = '2026-02-28';

function buildDefaultRuleMetadata(changelog: string[]): {
  managed_by: 'system_default';
  version: string;
  effective_from: string;
  changelog: string[];
} {
  return {
    managed_by: 'system_default',
    version: DEFAULT_RULESET_VERSION,
    effective_from: DEFAULT_RULESET_EFFECTIVE_FROM,
    changelog,
  };
}

export function getDefaultRuleChangelog(): {
  version: string;
  effective_from: string;
  changes: string[];
} {
  return {
    version: DEFAULT_RULESET_VERSION,
    effective_from: DEFAULT_RULESET_EFFECTIVE_FROM,
    changes: [
      'Scoped defaults by document type to reduce false positives.',
      'Added GST relevance gating to avoid non-GST document misflags.',
      'Aligned default rules with evidence-first risk scoring strategy.',
    ],
  };
}

// ============================================================================
// Rule Execution Functions
// ============================================================================

export function executeThresholdRule(
  rule: DynamicRule,
  documentId: string,
  tenantId: string,
  extractedData: Record<string, any>
): RiskSignalInput | null {
  const config = rule.config as ThresholdRuleConfig;
  const fieldValue = getNestedValue(extractedData, config.field);
  
  if (fieldValue === undefined || fieldValue === null) {
    return null;
  }
  
  const numericValue = Number(fieldValue);
  if (isNaN(numericValue)) {
    return null;
  }
  
  const threshold = config.value;
  let violated = false;
  
  switch (config.operator) {
    case '>':
      violated = numericValue > threshold;
      break;
    case '<':
      violated = numericValue < threshold;
      break;
    case '>=':
      violated = numericValue >= threshold;
      break;
    case '<=':
      violated = numericValue <= threshold;
      break;
    case '=':
      violated = numericValue === threshold;
      break;
    case '!=':
      violated = numericValue !== threshold;
      break;
  }
  
  if (!violated) return null;
  
  const unit = config.unit ? ` ${config.unit}` : '';
  const recommendation: Recommendation = {
    action_type: 'review',
    message: `Verify ${config.field} value of ${numericValue}${unit} against threshold (${config.operator} ${threshold}${unit})`,
    priority: mapSeverityToPriority(rule.severity as Severity),
  };
  
  return {
    tenant_id: tenantId,
    document_id: documentId,
    type: 'rule_violation',
    subtype: 'threshold_exceeded',
    severity: rule.severity as Severity,
    confidence: 0.95,
    weight: rule.weight,
    explanation: `${config.field} value ${numericValue}${unit} ${config.operator} threshold ${threshold}${unit}`,
    recommendation,
    metadata: {
      rule_id: rule.id,
      rule_name: rule.name,
      field: config.field,
      value: numericValue,
      operator: config.operator,
      threshold,
    },
  };
}

export function executeRequiredFieldRule(
  rule: DynamicRule,
  documentId: string,
  tenantId: string,
  extractedData: Record<string, any>
): RiskSignalInput | null {
  const config = rule.config as RequiredFieldRuleConfig;
  const fieldValue = getNestedValue(extractedData, config.field);
  
  // Check if field is missing, null, undefined, or empty
  const isMissing = 
    fieldValue === undefined || 
    fieldValue === null || 
    (typeof fieldValue === 'string' && fieldValue.trim() === '') ||
    (Array.isArray(fieldValue) && fieldValue.length === 0);
  
  const allowEmpty = config.allow_empty ?? false;
  
  if (!isMissing || allowEmpty) {
    return null;
  }
  
  const recommendation: Recommendation = {
    action_type: 'request_info',
    message: `Provide missing ${config.field} information`,
    priority: mapSeverityToPriority(rule.severity as Severity),
  };
  
  return {
    tenant_id: tenantId,
    document_id: documentId,
    type: 'missing_field',
    subtype: 'required_field_missing',
    severity: rule.severity as Severity,
    confidence: 1.0,
    weight: rule.weight,
    explanation: `Required field ${config.field} is missing or empty`,
    recommendation,
    metadata: {
      rule_id: rule.id,
      rule_name: rule.name,
      field: config.field,
    },
  };
}

export function executeConsistencyRule(
  rule: DynamicRule,
  documentId: string,
  tenantId: string,
  extractedData: Record<string, any>
): RiskSignalInput | null {
  const config = rule.config as ConsistencyRuleConfig;
  
  // Get values for all fields
  const values = config.fields.map(field => ({
    field,
    value: getNestedValue(extractedData, field),
  }));
  
  // Check if all fields have values
  const missingFields = values.filter(v => v.value === undefined || v.value === null);
  if (missingFields.length > 0) {
    return null; // Can't check consistency if fields are missing
  }
  
  // Get numeric values for comparison
  const numericValues = values.map(v => Number(v.value)).filter(v => !isNaN(v));
  if (numericValues.length < 2) {
    return null; // Need at least 2 numeric values
  }
  
  // Check consistency based on comparison type
  const comparisonType = config.comparison_type || 'percentage';
  let consistent = true;
  let maxDiff = 0;
  
  if (comparisonType === 'exact') {
    const firstValue = numericValues[0];
    consistent = numericValues.every(v => v === firstValue);
  } else if (comparisonType === 'percentage') {
    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    maxDiff = max === 0 ? 0 : ((max - min) / max) * 100;
    consistent = maxDiff <= config.tolerance;
  } else if (comparisonType === 'absolute') {
    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    maxDiff = max - min;
    consistent = maxDiff <= config.tolerance;
  }
  
  if (consistent) return null;
  
  const fieldDescriptions = values.map(v => `${v.field}=${v.value}`).join(', ');
  const recommendation: Recommendation = {
    action_type: 'verify',
    message: `Check consistency between ${config.fields.join(' and ')}`,
    priority: mapSeverityToPriority(rule.severity as Severity),
  };
  
  return {
    tenant_id: tenantId,
    document_id: documentId,
    type: 'mismatch',
    subtype: 'consistency_check_failed',
    severity: rule.severity as Severity,
    confidence: 0.9,
    weight: rule.weight,
    explanation: `Inconsistency detected: ${fieldDescriptions}. Difference: ${maxDiff.toFixed(2)}${comparisonType === 'percentage' ? '%' : ''} (tolerance: ${config.tolerance})`,
    recommendation,
    metadata: {
      rule_id: rule.id,
      rule_name: rule.name,
      fields: config.fields,
      values: values.map(v => ({ field: v.field, value: v.value })),
      difference: maxDiff,
      tolerance: config.tolerance,
    },
  };
}

export function executeTimeRule(
  rule: DynamicRule,
  documentId: string,
  tenantId: string,
  extractedData: Record<string, any>
): RiskSignalInput | null {
  const config = rule.config as TimeRuleConfig;
  
  // Get date value from field or use document metadata
  const dateValue = config.field 
    ? getNestedValue(extractedData, config.field)
    : extractedData.document_date || extractedData.invoice_date;
  
  if (!dateValue) {
    return null;
  }
  
  const documentDate = new Date(dateValue);
  if (isNaN(documentDate.getTime())) {
    return null;
  }
  
  // Determine reference date
  let referenceDate: Date;
  const reference = config.reference_date || 'today';
  
  switch (reference) {
    case 'today':
      referenceDate = new Date();
      break;
    case 'document_date':
      return null; // Can't calculate gap to itself
    case 'upload_date':
      referenceDate = new Date(extractedData.uploaded_at || Date.now());
      break;
    default:
      referenceDate = new Date();
  }
  
  // Calculate gap in days
  const diffMs = referenceDate.getTime() - documentDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= config.max_gap_days) {
    return null;
  }
  
  const recommendation: Recommendation = {
    action_type: 'review',
    message: `Document date is ${diffDays} days old, exceeding limit of ${config.max_gap_days} days`,
    priority: mapSeverityToPriority(rule.severity as Severity),
  };
  
  return {
    tenant_id: tenantId,
    document_id: documentId,
    type: 'rule_violation',
    subtype: 'time_rule_violation',
    severity: rule.severity as Severity,
    confidence: 1.0,
    weight: rule.weight,
    explanation: `Document date (${documentDate.toISOString().split('T')[0]}) is ${diffDays} days old, exceeding maximum gap of ${config.max_gap_days} days`,
    recommendation,
    metadata: {
      rule_id: rule.id,
      rule_name: rule.name,
      document_date: documentDate.toISOString(),
      reference_date: referenceDate.toISOString(),
      gap_days: diffDays,
      max_gap_days: config.max_gap_days,
    },
  };
}

// ============================================================================
// Main Rule Execution Orchestrator
// ============================================================================

export function executeRule(
  rule: DynamicRule,
  documentId: string,
  tenantId: string,
  extractedData: Record<string, any>
): RiskSignalInput | null {
  if (!rule.is_active) {
    return null;
  }

  if (!isRuleApplicableToDocument(rule, extractedData)) {
    return null;
  }
  
  switch (rule.rule_type) {
    case 'threshold':
      return executeThresholdRule(rule, documentId, tenantId, extractedData);
    case 'required':
      return executeRequiredFieldRule(rule, documentId, tenantId, extractedData);
    case 'consistency':
      return executeConsistencyRule(rule, documentId, tenantId, extractedData);
    case 'time':
      return executeTimeRule(rule, documentId, tenantId, extractedData);
    default:
      return null;
  }
}

export function executeRules(
  rules: DynamicRule[],
  documentId: string,
  tenantId: string,
  extractedData: Record<string, any>
): RiskSignalInput[] {
  const signals: RiskSignalInput[] = [];
  
  for (const rule of rules) {
    const signal = executeRule(rule, documentId, tenantId, extractedData);
    if (signal) {
      signals.push(signal);
    }
  }
  
  return signals;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[key];
  }
  
  return value;
}

function mapSeverityToPriority(severity: Severity): 'low' | 'medium' | 'high' | 'critical' {
  const mapping: Record<Severity, 'low' | 'medium' | 'high' | 'critical'> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
  };
  return mapping[severity];
}

// ============================================================================
// Default Rules
// ============================================================================

export function getDefaultRules(tenantId: string): Omit<DynamicRule, 'id' | 'created_at' | 'updated_at'>[] {
  return [
    {
      tenant_id: tenantId,
      name: 'High Value Invoice Check',
      rule_type: 'threshold',
      config: {
        field: 'totalAmount',
        operator: '>',
        value: 100000,
        unit: 'INR',
        document_types: ['invoice'],
        rule_metadata: buildDefaultRuleMetadata([
          'Applied invoice-only scope for high-value threshold checks.',
        ]),
      } as ThresholdRuleConfig,
      severity: 'medium',
      weight: 1.5,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      name: 'GST Number Required',
      rule_type: 'required',
      config: {
        field: 'vendorGstin',
        allow_empty: false,
        document_types: ['invoice', 'gst', 'tax invoice'],
        rule_metadata: buildDefaultRuleMetadata([
          'Limited GSTIN requirement to GST/tax/invoice documents.',
        ]),
      } as RequiredFieldRuleConfig,
      severity: 'high',
      weight: 2.0,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      name: 'Invoice-Bank Amount Consistency',
      rule_type: 'consistency',
      config: {
        fields: ['totalAmount', 'bankAmount'],
        tolerance: 1,
        comparison_type: 'percentage',
        document_types: ['invoice', 'bank statement'],
        rule_metadata: buildDefaultRuleMetadata([
          'Restricted amount consistency rule to invoice/bank contexts.',
        ]),
      } as ConsistencyRuleConfig,
      severity: 'high',
      weight: 2.5,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      name: 'Recent Document Check',
      rule_type: 'time',
      config: {
        field: 'invoice_date',
        max_gap_days: 90,
        reference_date: 'today',
        document_types: ['invoice'],
        rule_metadata: buildDefaultRuleMetadata([
          'Restricted recency check to invoice date fields.',
        ]),
      } as TimeRuleConfig,
      severity: 'low',
      weight: 1.0,
      is_active: true,
    },
  ];
}

function isRuleApplicableToDocument(
  rule: DynamicRule,
  extractedData: Record<string, any>
): boolean {
  const context = getDocumentContextText(extractedData);
  const config = rule.config as {
    document_types?: string[];
    field?: string;
    fields?: string[];
  };

  // Explicit document-type scope from rule config.
  if (Array.isArray(config.document_types) && config.document_types.length > 0) {
    const normalizedTypes = config.document_types
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    if (
      normalizedTypes.length > 0 &&
      !normalizedTypes.some((type) => context.includes(type))
    ) {
      return false;
    }
  }

  // Defensive fallback: skip GST-centric checks for non-GST/non-invoice docs.
  const fieldText = [config.field, ...(config.fields || [])]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  const ruleText = `${rule.name} ${fieldText}`.toLowerCase();
  const gstCentric = /gst|gstin|tax/.test(ruleText);
  const gstRelevantDoc = /gst|tax|invoice/.test(context);
  if (gstCentric && !gstRelevantDoc) {
    return false;
  }

  return true;
}

function getDocumentContextText(extractedData: Record<string, any>): string {
  return [
    extractedData.documentType,
    extractedData.docType,
    extractedData.type,
    extractedData.document_type,
    extractedData.filename,
    extractedData.name,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
}
