import axios from 'axios';
import type { RiskSignal } from '../services/risk/types';

// All API calls use relative URLs so they go through the Vite dev proxy (same origin).
// This ensures session cookies set by the backend are sent with every request.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? '';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Don't set a global Content-Type. Axios will set the correct header per-request:
  // - JSON: application/json
  // - FormData: multipart/form-data (with boundary)
  headers: {
    Accept: 'application/json',
  },
  withCredentials: true, // Important for session cookies
});

// --- Mobile web offline queue support (best-effort) ---
// If offline, we can enqueue certain JSON requests and retry later.
// Uploads (multipart) are not queued here.
import { enqueue } from '../mobile/offlineQueue';

// ============================================================================
// Auth
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthMeResponse {
  success: boolean;
  user: AuthUser;
}

export async function getMe(): Promise<AuthMeResponse> {
  const response = await apiClient.get<AuthMeResponse>('/api/auth/me');
  return response.data;
}

export interface AuthTokenExchangeResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export async function exchangeAuthToken(token: string): Promise<AuthTokenExchangeResponse> {
  const response = await apiClient.post<AuthTokenExchangeResponse>('/api/auth/token-exchange', { token });
  return response.data;
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/auth/logout', {});
  return response.data;
}

// ============================================================================
// Workspaces
// ============================================================================

export interface WorkspaceMembership {
  tenantId: string;
  name: string;
  role: 'owner' | 'admin' | 'reviewer' | 'viewer' | string;
}

export async function listWorkspaces(): Promise<{ success: boolean; workspaces: WorkspaceMembership[]; count: number }> {
  const response = await apiClient.get<{ success: boolean; workspaces: WorkspaceMembership[]; count: number }>('/api/workspaces');
  return response.data;
}

export async function selectWorkspace(tenantId: string): Promise<{ success: boolean; tenantId: string; role: string }> {
  const response = await apiClient.post<{ success: boolean; tenantId: string; role: string }>('/api/workspaces/select', { tenantId });
  return response.data;
}

// Attach JWT Bearer token from localStorage to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.request.use((config) => {
  // Never queue multipart/form-data (file uploads) - they must go through when online.
  const isFormData = config.data != null && config.data instanceof FormData;
  const isMultipart =
    (config.headers as any)?.['Content-Type']?.includes('multipart/form-data') ||
    (config.headers as any)?.['content-type']?.includes('multipart/form-data');
  if (isFormData || isMultipart) {
    // Let the browser set Content-Type with boundary for FormData (required for file upload)
    if (isFormData && config.headers) {
      const headers = config.headers as Record<string, unknown>;
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
    return config;
  }

  // Only queue JSON requests when offline.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const method = (config.method || 'get').toUpperCase();
    const isJson =
      (config.headers as any)?.['Content-Type']?.includes('application/json') ||
      (config.headers as any)?.['content-type']?.includes('application/json') ||
      config.data != null;

    if (isJson && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      enqueue({
        method: method as any,
        url: config.url || '',
        body: config.data ?? null,
      });
      return Promise.reject(new Error('OFFLINE_QUEUED'));
    }
  }
  return config;
});

export interface UploadResponse {
  success: boolean;
  document: {
    id: string;
    filename: string;
    uploadedAt: string;
    riskLevel: 'Critical' | 'Warning' | 'Normal';
    riskCategory?: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'None';
    riskConfidence?: number; // 0-100
    riskExplanation?: string;
    recommendations?: string[];
    numPages: number;
    numChunks: number;
  };
}


export interface ChatResponse {
  success: boolean;
  answer: string;
  confidence?: number; // 0-100
  citations: Array<{
    documentId: string;
    filename: string;
    content: string;
    similarity: number;
    confidence?: number; // 0-100
    metadata?: Record<string, any>;
  }>;
  sources: string[];
  serviceProviders?: {
    category: string;
    providers: ServiceProvider[];
    message: string;
  };
}

export interface ChatRequest {
  question: string;
  language?: string;
  topK?: number;
  documentIds?: string[]; // For multi-document chat
  userLocation?: Location; // User location for service providers
  /** Role-based view: user = simple, manager = risk & cost, auditor = clauses & citations */
  viewAs?: 'user' | 'manager' | 'auditor';
}

export interface Document {
  id: string;
  filename: string;
  uploadedAt: string;
  riskLevel: 'Critical' | 'Warning' | 'Normal';
  riskCategory?: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'None';
  riskConfidence?: number;
  riskScore?: number | null;
  summary?: string | null;
  extractedData?: Record<string, any> | null;
  vendorName?: string | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'info_requested' | string;
  versionNumber?: number;
  folderId?: string | null;
  metadata?: Record<string, any>;
}

export interface DocumentsResponse {
  success: boolean;
  documents: Document[];
  count: number;
}

export interface ComparisonResponse {
  success: boolean;
  comparison: {
    v1: {
      filename: string;
      riskLevel: string;
      riskCategory: string;
      riskConfidence: number;
      numPages: number;
    };
    v2: {
      id: string;
      filename: string;
      riskLevel: string;
      riskCategory: string;
      riskConfidence: number;
      numPages: number;
    };
    changes: {
      addedLines: number;
      removedLines: number;
      modifiedLines: number;
      added: string[];
      removed: string[];
      modified: Array<{ old: string; new: string }>;
    };
    newRisks: string[];
    riskChange: {
      levelChanged: boolean;
      categoryChanged: boolean;
      confidenceChange: number;
    };
  };
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Do not set Content-Type so the browser sets it with boundary (required for multipart)
  const response = await apiClient.post<UploadResponse>('/api/upload', formData, {
    timeout: 300000, // 5 minutes timeout for large files
    onUploadProgress: (progressEvent) => {
      // Progress tracking can be added here if needed
      if (progressEvent.total) {
        // const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        // You can emit this to a progress callback if needed
      }
    },
  });

  return response.data;
}

export interface FinancialCompareRequest {
  docIds: string[];
}

export interface FinancialCompareResponse {
  success: boolean;
  comparisonId: string | null;
  documents: Array<{
    id: string;
    filename: string;
    extractedData: Record<string, any>;
    summary?: string | null;
    riskScore?: number | null;
    riskLevel?: string | null;
  }>;
  mismatches: Array<{
    field: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    explanation?: string | null;
    docs?: any;
  }>;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
}

export async function compareFinancialDocuments(request: FinancialCompareRequest): Promise<FinancialCompareResponse> {
  const response = await apiClient.post<FinancialCompareResponse>('/api/compare', request);
  return response.data;
}

export interface GenerateReportRequest {
  documentIds: string[];
}

export interface GenerateReportResponse {
  success: boolean;
  reportId: string | null;
  report: string;
  documentIds: string[];
  createdAt: string;
}

export async function generateAuditReport(request: GenerateReportRequest): Promise<GenerateReportResponse> {
  const response = await apiClient.post<GenerateReportResponse>('/api/report', request);
  return response.data;
}

export async function uploadTextDocument(title: string, content: string): Promise<UploadResponse> {
  const response = await apiClient.post<UploadResponse>('/api/upload/text', {
    title,
    content,
  });
  return response.data;
}

export async function uploadEmailDocument(subject: string, body: string): Promise<UploadResponse> {
  const response = await apiClient.post<UploadResponse>('/api/upload/email', {
    subject,
    body,
  });
  return response.data;
}

export async function uploadFiles(files: File[]): Promise<UploadResponse[]> {
  const uploadPromises = files.map(file => uploadFile(file));
  return Promise.all(uploadPromises);
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await apiClient.post<ChatResponse>('/api/chat', request);
  return response.data;
}

export interface ExplainRequest {
  documentId: string;
  language?: string;
}

export interface ExplainResponse {
  success: boolean;
  explanation: string;
  language: string;
  document: {
    id: string;
    filename: string;
    riskLevel: string;
    riskCategory?: string;
  };
}

export async function explainDocument(request: ExplainRequest): Promise<ExplainResponse> {
  const response = await apiClient.post<ExplainResponse>('/api/explain', request);
  return response.data;
}

export interface DocumentContentResponse {
  success: boolean;
  documentId: string;
  content: string;
  filename: string;
}

export async function getDocumentContent(documentId: string): Promise<DocumentContentResponse> {
  const response = await apiClient.get<DocumentContentResponse>(`/api/documents/${documentId}/content`);
  return response.data;
}

export interface DocumentDetailsResponse {
  success: boolean;
  document: Document;
}

export async function getDocument(documentId: string): Promise<DocumentDetailsResponse> {
  const response = await apiClient.get<DocumentDetailsResponse>(`/api/documents/${documentId}`);
  return response.data;
}

export async function getDocuments(filters?: {
  riskLevel?: 'Critical' | 'Warning' | 'Normal';
  riskCategory?: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'None';
  documentIds?: string[];
}): Promise<DocumentsResponse> {
  const params = new URLSearchParams();
  if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
  if (filters?.riskCategory) params.append('riskCategory', filters.riskCategory);
  if (filters?.documentIds) {
    filters.documentIds.forEach(id => params.append('documentIds', id));
  }

  const response = await apiClient.get<DocumentsResponse>(`/api/documents?${params.toString()}`);
  return response.data;
}

export interface DeleteDocumentResponse {
  success: boolean;
  message: string;
  documentId: string;
}

export async function deleteDocument(documentId: string): Promise<DeleteDocumentResponse> {
  const response = await apiClient.delete<DeleteDocumentResponse>(`/api/documents/${documentId}`);
  return response.data;
}

export interface ServiceProvider {
  id: string;
  name: string;
  type: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  rating?: number;
  specialization?: string[];
  distance?: number;
  website?: string;
}

export interface ServiceProvidersResponse {
  success: boolean;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  providers: ServiceProvider[];
  count: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

export type ServiceProviderCategory = 'NBFC' | 'CharteredAccountant' | 'DPDPConsultant' | 'None';

export async function getServiceProviders(
  category: ServiceProviderCategory,
  location: Location
): Promise<ServiceProvidersResponse> {
  const response = await apiClient.post<ServiceProvidersResponse>('/api/service-providers', {
    category,
    latitude: location.latitude,
    longitude: location.longitude,
    limit: 5,
  });
  return response.data;
}

export interface QuickQuestionsResponse {
  success: boolean;
  questions: string[];
}

export async function getQuickQuestions(documentId: string): Promise<QuickQuestionsResponse> {
  const response = await apiClient.post<QuickQuestionsResponse>('/api/chat/quick-questions', {
    documentId,
  });
  return response.data;
}

// What If Simulator
export interface WhatIfRequest {
  documentId: string;
  scenario: string;
  language?: string;
}

export interface Consequence {
  category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Reputational';
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  likelihood: 'Unlikely' | 'Possible' | 'Likely' | 'Very Likely';
  impact: string;
}

export interface WhatIfResponse {
  success: boolean;
  analysis: {
    scenario: string;
    consequences: Consequence[];
    overallSeverity: 'Low' | 'Medium' | 'High' | 'Critical';
    recommendations: string[];
    riskScore: number;
  };
  language: string;
}

export async function analyzeWhatIf(request: WhatIfRequest): Promise<WhatIfResponse> {
  const response = await apiClient.post<WhatIfResponse>('/api/what-if', request);
  return response.data;
}

// Voice Mode
export interface VoiceQueryRequest {
  question: string;
  documentIds?: string[];
  language?: string;
  userLocation?: Location;
}

export interface VoiceQueryResponse {
  success: boolean;
  answer: string;
  confidence?: number;
  citations?: ChatResponse['citations'];
  sources?: string[];
  voiceResponse: boolean;
}

export async function sendVoiceQuery(request: VoiceQueryRequest): Promise<VoiceQueryResponse> {
  const response = await apiClient.post<VoiceQueryResponse>('/api/voice/query', request);
  return response.data;
}

// Trust Score
export interface TrustScoreRequest {
  documentId: string;
}

export interface TrustScoreFactor {
  score: number;
  weight: number;
  details: string | string[];
}

export interface TrustScoreResponse {
  success: boolean;
  analysis: {
    trustScore: number;
    status: 'Safe' | 'Needs Review' | 'Dangerous';
    factors: {
      riskLevel: TrustScoreFactor;
      missingClauses: TrustScoreFactor;
      unusualPatterns: TrustScoreFactor;
      ambiguousLanguage: TrustScoreFactor;
      expiryOrOutdated: TrustScoreFactor;
    };
    summary: string;
    recommendations: string[];
  };
  document: {
    id: string;
    filename: string;
    riskLevel: string;
    riskCategory?: string;
  };
}

export async function getTrustScore(request: TrustScoreRequest): Promise<TrustScoreResponse> {
  const response = await apiClient.post<TrustScoreResponse>('/api/trust-score', request);
  return response.data;
}

// Agent Swarm
export interface AgentSwarmRequest {
  documentId: string;
  userParty?: string;
  jurisdictions?: string[];
}

export interface AgentSwarmResponse {
  success: boolean;
  result: {
    documentId: string;
    filename: string;
    status: 'completed' | 'partial' | 'failed';
    agents: {
      extractor: {
        status: 'completed' | 'failed';
        data?: any;
        error?: string;
      };
      riskAnalyst: {
        status: 'completed' | 'failed';
        analysis?: any;
        error?: string;
      };
      compliance: {
        status: 'completed' | 'failed';
        analysis?: any;
        error?: string;
      };
      negotiation: {
        status: 'completed' | 'failed';
        strategy?: any;
        error?: string;
      };
      action: {
        status: 'completed' | 'failed';
        plan?: any;
        error?: string;
      };
    };
    executionTime: number;
    timestamp: string;
  };
}

export async function executeAgentSwarm(request: AgentSwarmRequest): Promise<AgentSwarmResponse> {
  const response = await apiClient.post<AgentSwarmResponse>('/api/agent-swarm', request);
  return response.data;
}

// Document Completeness Check
export interface CompletenessRequest {
  documentId: string;
  documentType?: string;
}

export interface CompletenessResponse {
  success: boolean;
  analysis: {
    completenessScore: number;
    overallStatus: 'Complete' | 'Mostly Complete' | 'Incomplete' | 'Very Incomplete';
    missingElements: Array<{
      category: string;
      item: string;
      description: string;
      priority: 'Critical' | 'High' | 'Medium' | 'Low';
      reason: string;
      suggestion?: string;
    }>;
    summary: string;
    recommendations: string[];
  };
  document: {
    id: string;
    filename: string;
  };
}

export async function checkDocumentCompleteness(request: CompletenessRequest): Promise<CompletenessResponse> {
  const response = await apiClient.post<CompletenessResponse>(`/api/completeness/${request.documentId}`, {
    documentType: request.documentType,
  });
  return response.data;
}

// Folders
export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface FoldersResponse {
  success: boolean;
  folders: Folder[];
}

export interface CreateFolderRequest {
  name: string;
}

export interface CreateFolderResponse {
  success: boolean;
  folder: Folder;
}

export interface UpdateFolderRequest {
  name: string;
}

export interface MoveDocumentRequest {
  folderId: string;
  documentId: string;
}

export async function getFolders(): Promise<FoldersResponse> {
  const response = await apiClient.get<FoldersResponse>('/api/folders');
  return response.data;
}

export async function createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
  const response = await apiClient.post<CreateFolderResponse>('/api/folders', request);
  return response.data;
}

export async function updateFolder(folderId: string, request: UpdateFolderRequest): Promise<CreateFolderResponse> {
  const response = await apiClient.put<CreateFolderResponse>(`/api/folders/${folderId}`, request);
  return response.data;
}

export async function deleteFolder(folderId: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(`/api/folders/${folderId}`);
  return response.data;
}

export async function moveDocumentToFolder(request: MoveDocumentRequest): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    `/api/folders/${request.folderId}/documents/${request.documentId}`,
    {}
  );
  return response.data;
}

export async function removeDocumentFromFolder(folderId: string, documentId: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/api/folders/${folderId}/documents/${documentId}`
  );
  return response.data;
}

export async function organizeFoldersByYear(): Promise<{ success: boolean; message: string; moved: number; total: number }> {
  const response = await apiClient.post<{ success: boolean; message: string; moved: number; total: number }>('/api/folders/organize-by-year', {});
  return response.data;
}

export async function organizeFoldersByVendor(): Promise<{ success: boolean; message: string; moved: number; total: number; vendors: number }> {
  const response = await apiClient.post<{ success: boolean; message: string; moved: number; total: number; vendors: number }>('/api/folders/organize-by-vendor', {});
  return response.data;
}

// Negotiation simulator (prepare strategy, talking points)
export async function prepareNegotiation(documentText: string): Promise<{
  success: boolean;
  extractedTerms?: any;
  marketResearch?: any;
  counterProposal?: any;
}> {
  const response = await apiClient.post('/api/negotiation/prepare', { documentText });
  return response.data;
}

// Financial Health Dashboard
export type DashboardRiskLevel = 'Green' | 'Yellow' | 'Red';

export interface DashboardHealthSummary {
  totalDocuments: number;
  criticalCount: number;
  warningCount: number;
  normalCount: number;
  riskLevel: DashboardRiskLevel;
  message: string;
  suggestExpert: boolean;
  youAreSafe: boolean;
}

export async function getDashboardHealth(): Promise<{ success: boolean; summary: DashboardHealthSummary }> {
  const response = await apiClient.get<{ success: boolean; summary: DashboardHealthSummary }>('/api/dashboard/health');
  return response.data;
}

// Rename Document
export interface RenameDocumentRequest {
  filename: string;
}

export interface RenameDocumentResponse {
  success: boolean;
  message: string;
  document: {
    id: string;
    filename: string;
  };
}

export async function renameDocument(documentId: string, filename: string): Promise<RenameDocumentResponse> {
  const response = await apiClient.put<RenameDocumentResponse>(
    `/api/documents/${documentId}/rename`,
    { filename }
  );
  return response.data;
}

// Approvals
export async function approveDocument(documentId: string, notes?: string): Promise<any> {
  const response = await apiClient.post(`/api/documents/${documentId}/approve`, { notes });
  return response.data;
}

export async function rejectDocument(documentId: string, notes: string): Promise<any> {
  const response = await apiClient.post(`/api/documents/${documentId}/reject`, { notes });
  return response.data;
}

export async function requestInfo(documentId: string, notes?: string): Promise<any> {
  const response = await apiClient.post(`/api/documents/${documentId}/request-info`, { notes });
  return response.data;
}

export async function getDocumentRisk(documentId: string): Promise<{
  success: boolean;
  documentId: string;
  riskResult: null | {
    risk_score: number;
    risk_level: string;
    summary: string;
    recommendations: any[];
    plain_english_explanations?: string[];
  };
  riskSignals: RiskSignal[];
}> {
  const response = await apiClient.get(`/api/documents/${documentId}/risk`);
  return response.data;
}

export async function fetchDocumentFile(documentId: string): Promise<{
  blob: Blob;
  contentType: string;
  filename: string;
}> {
  const response = await apiClient.get<Blob>(`/api/documents/${documentId}/file`, {
    responseType: 'blob',
  });
  const contentType =
    (response.headers as any)?.['content-type'] ||
    (response.headers as any)?.['Content-Type'] ||
    'application/octet-stream';
  const cd = ((response.headers as any)?.['content-disposition'] || '') as string;
  const filenameMatch = cd.match(/filename="([^"]+)"/i);
  const filename = filenameMatch?.[1] || 'document';
  return { blob: response.data as any, contentType: String(contentType), filename };
}

// Compliance / Audit logs (used for Activity feed)
export interface AuditLogItem {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string; // ISO string
  complianceFlags: string[];
}

export async function getAuditLogs(params?: {
  resourceType?: string;
  resourceId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; logs: AuditLogItem[]; total: number; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params?.resourceType) sp.set('resourceType', params.resourceType);
  if (params?.resourceId) sp.set('resourceId', params.resourceId);
  if (params?.action) sp.set('action', params.action);
  if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') sp.set('offset', String(params.offset));
  const response = await apiClient.get<{ success: boolean; logs: AuditLogItem[]; total: number; limit: number; offset: number }>(
    `/api/compliance/audit-logs?${sp.toString()}`
  );
  return response.data;
}

/** Public shared document (no auth). Used when opening a shared link. */
export interface SharedDocumentResponse {
  success: boolean;
  document: {
    id: string;
    filename: string;
    uploadedAt: string;
    riskLevel: string;
    riskCategory: string | null;
    riskConfidence: number | null;
    riskExplanation: string | null;
    recommendations: string[];
  };
}

export async function getSharedDocument(documentId: string): Promise<SharedDocumentResponse> {
  const response = await apiClient.get<SharedDocumentResponse>(`/api/documents/${documentId}/shared`);
  return response.data;
}

// Document verification
export interface VerificationResponse {
  success: boolean;
  verification: {
    isAuthentic: boolean;
    isAuthorized: boolean;
    fraudScore: number;
    confidence: number;
    status: 'Verified' | 'Suspicious' | 'Fraudulent' | 'Unknown';
    checks: Record<string, { passed: boolean; score: number; details: string }>;
    warnings: string[];
    recommendations: string[];
  };
  document: { id: string; filename: string };
}

export async function verifyDocument(documentId: string): Promise<VerificationResponse> {
  const response = await apiClient.post<VerificationResponse>(`/api/verify/${documentId}`);
  return response.data;
}

// Finance & Tax Tools
export const FINANCE_TOOL_IDS = [
  'bank-credit-card-statements',
  'tax-threshold-monitor',
  'real-time-tax-liability-estimator',
  'tax-liability-calculator',
  'investment-suggestions',
  'income-source-classification',
  'gst-registration-eligibility',
  'expense-contract-mismatch',
  'vendor-payment-reconciliation',
  'subscription-recurring-tracker',
  'penalty-late-fee-predictor',
  'multi-bill-summary-report',
  'fraud-duplicate-detection',
  'cost-trend-anomaly',
  'settlement-negotiation-suggestions',
  'bill-accounting-entry-generator',
] as const;

export type FinanceToolId = (typeof FINANCE_TOOL_IDS)[number];

export interface FinanceToolMeta {
  id: FinanceToolId;
  title: string;
}

export interface FinanceToolSection {
  heading: string;
  content: string;
  items?: string[];
}

export interface FinanceToolChartDataset {
  label: string;
  values: number[];
}

export interface FinanceToolChart {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  labels: string[];
  values?: number[];
  datasets?: FinanceToolChartDataset[];
}

export interface FinanceToolResult {
  success: boolean;
  toolId: FinanceToolId;
  title: string;
  summary: string;
  sections: FinanceToolSection[];
  charts?: FinanceToolChart[];
  /** When true, show "You Are Safe" confirmation (no liability / no action required). */
  youAreSafe?: boolean;
  /** Suggested next check date when safe. */
  nextCheckSuggested?: string;
  raw?: string;
  error?: string;
}

export async function getFinanceToolsList(): Promise<{ success: boolean; tools: FinanceToolMeta[] }> {
  const response = await apiClient.get<{ success: boolean; tools: FinanceToolMeta[] }>('/api/finance-tools/list');
  return response.data;
}

export async function runFinanceTool(
  toolId: FinanceToolId,
  documentIds: string[]
): Promise<{ success: boolean; result: FinanceToolResult }> {
  const response = await apiClient.post<{ success: boolean; result: FinanceToolResult }>('/api/finance-tools/run', {
    toolId,
    documentIds,
  });
  return response.data;
}

// --- Action Intelligence: What Should I Do Next ---
export interface ActionIntelligenceResult {
  immediateRisks: Array<{ severity: 'Critical' | 'Warning'; description: string }>;
  actionRequired: string;
  deadline: string | null;
  urgency: 'Critical' | 'High' | 'Medium' | 'Low' | 'None';
  whoShouldHandle: 'CA' | 'Lawyer' | 'User' | 'Compliance' | 'Financial';
  summaryStatement: string;
  suggestedNextStep: string;
}

export async function getWhatShouldIDoNext(documentId: string): Promise<{
  success: boolean;
  documentId: string;
  result: ActionIntelligenceResult;
}> {
  const response = await apiClient.post('/api/action-intelligence', { documentId });
  return response.data;
}

// --- Deadlines & Obligation Tracker ---
export interface DeadlineItem {
  id: string;
  document_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_type: string | null;
  reminder_sent: boolean;
  calendar_synced: boolean;
  severity: string;
  assignee_type: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDeadlines(params?: { documentId?: string; from?: string; to?: string }): Promise<{
  success: boolean;
  deadlines: DeadlineItem[];
}> {
  const q = new URLSearchParams();
  if (params?.documentId) q.set('documentId', params.documentId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const response = await apiClient.get(`/api/deadlines?${q.toString()}`);
  return response.data;
}

export async function createDeadline(data: {
  documentId: string;
  title: string;
  description?: string;
  due_date: string;
  due_type?: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  assignee_type?: string;
}): Promise<{ success: boolean; deadline: DeadlineItem }> {
  const response = await apiClient.post('/api/deadlines', data);
  return response.data;
}

export async function markDeadlineReminderSent(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/deadlines/${id}/reminder-sent`, {});
  return response.data;
}

export async function markDeadlineCalendarSynced(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/deadlines/${id}/calendar-synced`, {});
  return response.data;
}

export async function deleteDeadline(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/api/deadlines/${id}`);
  return response.data;
}

export function getDeadlinesIcalUrl(from?: string, to?: string): string {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return `${API_BASE_URL}/api/deadlines/export/ical?${q.toString()}`;
}

// --- Financial Impact Estimator ---
export async function getFinancialImpact(
  documentId: string,
  scenario?: string
): Promise<{
  success: boolean;
  documentId: string;
  estimate: {
    taxPayable: { amount: number | null; currency: string; description: string } | null;
    lateFees: { amount: number | null; currency: string; description: string } | null;
    interest: { amount: number | null; rate: string; description: string } | null;
    worstCaseExposure: { amount: number | null; currency: string; description: string } | null;
    summary: string;
    scenario?: string | null;
  };
}> {
  const response = await apiClient.post('/api/financial-impact', { documentId, scenario });
  return response.data;
}

// --- Explain with level (simple / detailed / professional) ---
export interface ExplainRequestWithLevel extends ExplainRequest {
  level?: 'simple' | 'detailed' | 'professional';
}

export async function explainDocumentWithLevel(
  request: ExplainRequestWithLevel
): Promise<ExplainResponse & { level?: string }> {
  const response = await apiClient.post('/api/explain', request);
  return response.data;
}

// --- Risk Clauses (Why Is This Risky? red/amber/green) ---
export interface RiskClauseItem {
  severity: 'red' | 'amber' | 'green';
  clauseText: string;
  startOffset?: number;
  endOffset?: number;
  reason: string;
}

export async function getRiskClauses(documentId: string): Promise<{
  success: boolean;
  documentId: string;
  clauses: RiskClauseItem[];
  summary: string;
}> {
  const response = await apiClient.get(`/api/risk-clauses/${documentId}`);
  return response.data;
}

// --- Document Comments ---
export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export async function getDocumentComments(documentId: string): Promise<{
  success: boolean;
  comments: DocumentComment[];
}> {
  const response = await apiClient.get(`/api/comments/${documentId}`);
  return response.data;
}

export async function createDocumentComment(
  documentId: string,
  content: string,
  mentions?: string[]
): Promise<{ success: boolean; comment: DocumentComment }> {
  const response = await apiClient.post('/api/comments', { documentId, content, mentions });
  return response.data;
}

export async function updateDocumentComment(
  commentId: string,
  content: string
): Promise<{ success: boolean; comment: DocumentComment }> {
  const response = await apiClient.put(`/api/comments/${commentId}`, { content });
  return response.data;
}

export async function deleteDocumentComment(commentId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/api/comments/${commentId}`);
  return response.data;
}

// --- Policy & SOP Matcher ---
export async function matchPolicyWithContract(
  policyDocumentId: string,
  contractDocumentId: string
): Promise<{
  success: boolean;
  policyDocumentId: string;
  contractDocumentId: string;
  policyFilename?: string;
  contractFilename?: string;
  policyViolations: Array<{ policyRule: string; contractClause: string; severity: string; description: string }>;
  missingClauses: Array<{ requiredByPolicy: string; suggestion: string; priority: string }>;
  summary: string;
}> {
  const response = await apiClient.post('/api/policy-matcher/match', {
    policyDocumentId,
    contractDocumentId,
  });
  return response.data;
}

// --- Share Safe Summary ---
export async function generateShareSummary(
  documentId: string,
  title?: string
): Promise<{
  success: boolean;
  documentId: string;
  title: string;
  summary: string;
  shareableText: string;
}> {
  const response = await apiClient.post('/api/share-summary/generate', { documentId, title });
  return response.data;
}

// --- Scam / Fraud Probability ---
export async function getScamScore(documentId: string): Promise<{
  success: boolean;
  documentId: string;
  scamProbability: number;
  signals: Array<{ type: string; description: string; severity: string }>;
  summary: string;
}> {
  const response = await apiClient.post('/api/scam-score', { documentId });
  return response.data;
}

// ============================================================================
// Vendor Links
// ============================================================================

export interface VendorLink {
  id: string;
  tenant_id: string;
  created_by: string;
  token: string;
  vendor_name: string;
  vendor_email: string | null;
  vendor_phone: string | null;
  vendor_pan: string | null;
  vendor_gstin: string | null;
  folder_id: string | null;
  folder_name?: string | null;
  description: string | null;
  template: string;
  required_documents: any[];
  status: 'active' | 'inactive';
  folder_status: 'pending' | 'under_review' | 'verified' | 'rejected';
  max_uploads: number;
  upload_count: number;
  expires_at: string | null;
  last_upload_at: string | null;
  analysis_data: any;
  analyzed_at: string | null;
  is_locked: boolean;
  locked_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name?: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  created_by_email?: string;
  document_count?: number;
  latest_upload?: string;
}

export interface VendorLinkIssue {
  id: string;
  category: 'missing' | 'mismatch' | 'format_error' | 'fraud' | 'warning' | 'suggestion';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedDocuments: string[];
  affectedDocumentNames: string[];
  recommendation: string;
  autoDetected: boolean;
  riskPoints: number;
}

export interface VendorAnalysis {
  overallRiskScore: number;
  overallRiskLevel: 'Safe' | 'Warning' | 'Critical';
  totalDocuments: number;
  issuesCount: number;
  issues: VendorLinkIssue[];
  missingDocuments: Array<{ type: string; label: string; mandatory: boolean }>;
  uploadedDocumentTypes: Array<{ type: string; label: string; documentId: string; filename: string }>;
  progress: { total: number; uploaded: number; mandatory: number; mandatoryUploaded: number; percentage: number; status: string };
  summary: string;
  vendorHealthScore: number;
  categories: Record<string, number>;
  duplicates: any[];
  formatErrors: any[];
  crossDocMismatches: any[];
}

export interface VendorComment {
  id: string;
  vendor_link_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  document_id: string | null;
  issue_id: string | null;
  content: string;
  comment_type: string;
  created_at: string;
}

export interface VendorActivity {
  id: string;
  vendor_link_id: string;
  user_id: string | null;
  actor_name: string;
  action: string;
  details: any;
  created_at: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  requiredDocuments: Array<{ type: string; label: string; mandatory: boolean; requiresAnalysis?: boolean; description?: string }>;
}

export interface CreateVendorLinkRequest {
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorPan?: string;
  vendorGstin?: string;
  description?: string;
  maxUploads?: number;
  expiresInDays?: number;
  template?: string;
  customRequiredDocuments?: any[];
}

// --- Templates ---
export async function getVendorTemplates(): Promise<{ success: boolean; templates: DocumentTemplate[] }> {
  const response = await apiClient.get('/api/vendor-links/templates');
  return response.data;
}

export async function createVendorTemplate(template: { id: string; name: string; description: string; requiredDocuments: any[] }): Promise<{ success: boolean; template: DocumentTemplate }> {
  const response = await apiClient.post('/api/vendor-links/templates', template);
  return response.data;
}

export async function updateVendorRequiredDocuments(linkId: string, requiredDocuments: any[]): Promise<{ success: boolean; requiredDocuments: any[] }> {
  const response = await apiClient.patch(`/api/vendor-links/${linkId}/required-documents`, { requiredDocuments });
  return response.data;
}

// --- CRUD ---
export async function getVendorLinks(filters?: {
  status?: string;
  folderStatus?: string;
  search?: string;
  riskLevel?: string;
  dateFrom?: string;
  dateTo?: string;
  hasMissing?: boolean;
  minCompletion?: number;
  maxCompletion?: number;
}): Promise<{ success: boolean; vendorLinks: VendorLink[]; count: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.folderStatus) params.append('folderStatus', filters.folderStatus);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  if (filters?.hasMissing) params.append('hasMissing', 'true');
  if (filters?.minCompletion != null) params.append('minCompletion', String(filters.minCompletion));
  if (filters?.maxCompletion != null) params.append('maxCompletion', String(filters.maxCompletion));
  const response = await apiClient.get(`/api/vendor-links?${params.toString()}`);
  return response.data;
}

export async function createVendorLink(request: CreateVendorLinkRequest): Promise<{ success: boolean; vendorLink: VendorLink; uploadUrl: string }> {
  const response = await apiClient.post('/api/vendor-links', request);
  return response.data;
}

export async function bulkCreateVendorLinks(vendors: any[], template?: string, expiresInDays?: number): Promise<{ success: boolean; created: any[]; count: number }> {
  const response = await apiClient.post('/api/vendor-links/bulk', { vendors, template, expiresInDays });
  return response.data;
}

export async function getVendorLinkDetail(linkId: string): Promise<{ success: boolean; vendorLink: VendorLink; documents: any[]; comments: VendorComment[]; activity: VendorActivity[] }> {
  const response = await apiClient.get(`/api/vendor-links/${linkId}`);
  return response.data;
}

export async function analyzeVendorLink(linkId: string): Promise<{ success: boolean; analysis: VendorAnalysis }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/analyze`);
  return response.data;
}

export async function reprocessVendorDocuments(linkId: string): Promise<{ success: boolean; documentsReprocessed: number }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/reprocess`);
  return response.data;
}

export async function deactivateVendorLink(linkId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/deactivate`);
  return response.data;
}

export async function activateVendorLink(linkId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/activate`);
  return response.data;
}

export async function deleteVendorLink(linkId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/api/vendor-links/${linkId}`);
  return response.data;
}

// --- Review ---
export async function reviewVendorLink(linkId: string, folderStatus: string, notes?: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/review`, { folderStatus, notes });
  return response.data;
}

export async function reviewVendorDocument(linkId: string, documentId: string, status: string, notes?: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/documents/${documentId}/review`, { status, notes });
  return response.data;
}

// --- Comments ---
export async function addVendorComment(linkId: string, content: string, opts?: { documentId?: string; issueId?: string; commentType?: string }): Promise<{ success: boolean; comment: VendorComment }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/comments`, { content, ...opts });
  return response.data;
}

// --- Lock/Unlock ---
export async function lockVendorFolder(linkId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/lock`);
  return response.data;
}

export async function unlockVendorFolder(linkId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/unlock`);
  return response.data;
}

// --- Reminder ---
export async function sendVendorReminder(linkId: string): Promise<{ success: boolean; emailSent: boolean; missingDocuments: any[] }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/remind`);
  return response.data;
}

// --- Audit Report ---
export async function getVendorAuditReport(linkId: string): Promise<{ success: boolean; report: any }> {
  const response = await apiClient.get(`/api/vendor-links/${linkId}/report`);
  return response.data;
}

// --- Financial Analysis ---
export async function runVendorFinancialAnalysis(linkId: string): Promise<{ success: boolean; financialAnalysis: any }> {
  const response = await apiClient.post(`/api/vendor-links/${linkId}/financial-analysis`, {}, { timeout: 120000 });
  return response.data;
}

// --- Public Portal ---
export async function getVendorPortalInfo(token: string): Promise<{
  success: boolean;
  portal: {
    vendorName: string;
    description: string | null;
    companyName: string;
    remainingUploads: number;
    branding: any;
    template: string;
    requiredDocuments: any[];
    uploadedDocuments: any[];
  };
}> {
  const response = await apiClient.get(`/api/vendor-links/portal/${token}`);
  return response.data;
}

export async function uploadToVendorPortal(token: string, file: File): Promise<{ success: boolean; document: { id: string; filename: string; riskLevel: string }; message: string; autoAnalysisTriggered?: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`/api/vendor-links/portal/${token}/upload`, formData, { timeout: 300000 });
  return response.data;
}

// ============================================================================
// GST Reconciliation & Regulatory Calendar
// ============================================================================

export interface GstReconciliationMismatch {
  type: 'missing_in_gstr' | 'missing_in_books' | 'amount_mismatch' | 'gstin_mismatch' | 'date_mismatch' | 'invoice_number_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  invoiceDocumentId: string | null;
  gstrDocumentId: string | null;
  vendorGstin: string | null;
  invoiceNumber: string | null;
  field: string;
  bookValue: string | number | null;
  gstrValue: string | number | null;
  description: string;
  itcImpact: number | null;
}

export interface GstReconciliationResult {
  tenantId: string;
  period: { from: string; to: string } | null;
  totalInvoices: number;
  totalGstrRecords: number;
  matched: number;
  mismatched: number;
  missingInGstr: number;
  missingInBooks: number;
  mismatches: GstReconciliationMismatch[];
  summary: {
    totalTaxableAmount: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGst: number;
    itcAtRisk: number;
    reconciliationScore: number;
  };
  recommendations: string[];
}

export async function runGstReconciliation(params?: { from?: string; to?: string }): Promise<{
  success: boolean;
  reconciliation: GstReconciliationResult;
}> {
  const response = await apiClient.post('/api/gst/reconcile', params || {});
  return response.data;
}

export interface RegulatoryDeadline {
  id: string;
  category: 'GST' | 'TDS' | 'Income Tax' | 'ROC' | 'ESI/PF';
  title: string;
  description: string;
  dueDate: string;
  applicableTo: string;
  penaltyInfo: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export async function getRegulatoryCalendar(params?: { month?: number; year?: number }): Promise<{
  success: boolean;
  year: number;
  month: number;
  deadlines: RegulatoryDeadline[];
  upcoming: RegulatoryDeadline[];
  overdue: number;
}> {
  const q = new URLSearchParams();
  if (params?.month) q.set('month', String(params.month));
  if (params?.year) q.set('year', String(params.year));
  const response = await apiClient.get(`/api/gst/calendar?${q.toString()}`);
  return response.data;
}

// --- Vendor Intelligence / 360° ---

export interface VendorPredictions {
  fraudProbability: number;
  paymentDefaultRisk: number;
  escalationRisk: number;
  overallRiskTrajectory: 'improving' | 'stable' | 'deteriorating';
  confidence: number;
  factors: string[];
}

export interface MonthlyTrendPoint {
  month: string;
  docCount: number;
  totalAmount: number;
  avgRiskScore: number;
  highRiskCount: number;
}

export interface RiskHeatmapPoint {
  month: string;
  rule: number;
  pattern: number;
  anomaly: number;
}

export interface VendorIntelligenceResponse {
  success: boolean;
  vendor: {
    key: string;
    name: string;
    gstin: string | null;
    firstTransaction: string | null;
    lastTransaction: string | null;
    totalDocuments: number;
    stats: {
      count: number;
      meanAmount: number;
      variance: number;
      stdDev: number;
      lastAmount: number;
    } | null;
  };
  financials: {
    totalInvoiceValue: number;
    totalGst: number;
    invoiceCount: number;
    avgInvoiceValue: number;
  };
  monthlyTrend: MonthlyTrendPoint[];
  predictions: VendorPredictions;
  heatmap: RiskHeatmapPoint[];
  recentDocuments: Array<{
    id: string;
    filename: string;
    uploadedAt: string;
    riskLevel: string;
    riskScore: number | null;
    amount: number | null;
  }>;
  patternHistory: Array<{
    eventType: string;
    severity: string;
    title: string;
    details: any;
    createdAt: string;
  }>;
  riskSignalSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface VendorListItem {
  key: string;
  name: string;
  gstin: string | null;
  documentCount: number;
  avgAmount: number;
  lastAmount: number;
  lastSeen: string | null;
}

export async function getVendorIntelligence(vendorKey: string): Promise<VendorIntelligenceResponse> {
  const response = await apiClient.get<VendorIntelligenceResponse>(`/api/vendor-intelligence/${encodeURIComponent(vendorKey)}`);
  return response.data;
}

export async function getVendorDirectory(): Promise<{ success: boolean; vendors: VendorListItem[]; count: number }> {
  const response = await apiClient.get('/api/vendor-intelligence');
  return response.data;
}

// --- Document Timeline ---

export interface TimelineEvent {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
  severity?: string;
}

export async function getDocumentTimeline(documentId: string): Promise<{ success: boolean; documentId: string; timeline: TimelineEvent[] }> {
  const response = await apiClient.get(`/api/documents/${documentId}/timeline`);
  return response.data;
}

// --- Auto-generated Drafts ---
export async function generateDraft(
  documentId: string,
  type: 'legal_reply' | 'email_response' | 'appeal_draft',
  userIntent?: string
): Promise<{
  success: boolean;
  documentId: string;
  type: string;
  draft: string;
  subject?: string;
  disclaimer: string;
}> {
  const response = await apiClient.post('/api/drafts/generate', {
    documentId,
    type,
    userIntent,
  });
  return response.data;
}


