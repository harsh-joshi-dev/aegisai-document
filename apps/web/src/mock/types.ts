import type { RiskSignal } from '../services/risk/types';

export type RiskLevel = 'Safe' | 'Review Required' | 'High' | 'Critical';
export type RiskLevelV2 = 'safe' | 'review' | 'high' | 'critical';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export type DocumentStatus =
  | 'pending'
  | 'review_required'
  | 'pending_info'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'under_review'
  | 'needs_info';

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  explanation: string;
  recommendation: string;
}

export interface Recommendation {
  id: string;
  text: string;
}

export interface DocumentRecord {
  id: string;
  tenant_id?: string;
  workspaceId: string;
  name: string;
  docType?: 'Invoice' | 'Bank' | 'GST' | 'Other';
  type?: string;
  vendor: string;
  amount: number;
  riskLevel: RiskLevel;
  riskScore: number;
  risk_level?: RiskLevelV2;
  risk_score?: number;
  status: DocumentStatus;
  preArchiveStatus?: DocumentStatus;
  assignedTo?: string | null;
  assignedAt?: string;
  requiredApprovals?: number;
  approvedBy?: string[];
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  slaDueAt?: string;
  escalationDueAt?: string;
  overdueAt?: string;
  escalatedAt?: string;
  date: string;
  gst: string;
  summary: string;
  issues: Issue[];
  recommendations: Recommendation[];
  mismatches: Array<{ field: string; sourceA: string; sourceB: string }>;
  patternAlerts: string[];
  /** Base64 data URL for PDF/image preview (e.g. data:application/pdf;base64,...) */
  fileUrl?: string;
  /** Linked document IDs for cross-document matching */
  linkedDocumentIds?: string[];
  /** Risk signals from engine (RULE | PATTERN | AI) */
  riskSignals?: RiskSignal[];
}

export interface WorkspaceSettings {
  tenant_id: string;
  assignmentStrategy: 'first' | 'round_robin' | 'least_loaded' | 'default';
  defaultReviewerId?: string;
  slaHours: number;
  escalationHours: number;
}

export interface NotificationItem {
  id: string;
  tenant_id: string;
  userId: string;
  ts: string;
  type: 'assign' | 'request_info' | 'escalation' | 'info';
  message: string;
  read?: boolean;
  docId?: string;
}

export interface AuditLogEntry {
  id: string;
  document_id?: string;
  tenant_id: string;
  action: string;
  performed_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  ts: string;
  actorEmail?: string;
  docId?: string;
  type:
    | 'uploaded'
    | 'assigned'
    | 'status_changed'
    | 'rule_created'
    | 'user_invited'
    | 'note';
  message: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Reviewer' | 'Viewer';
}

export interface RuleRecord {
  id: string;
  name: string;
  tenantId?: string;
  type: 'Threshold' | 'Required Field' | 'Consistency';
  config: string;
  severity: Severity;
  weight: number;
}
