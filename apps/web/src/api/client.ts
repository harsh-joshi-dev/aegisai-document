import axios from 'axios';

// Use backend origin so the session cookie (set by backend) is sent with requests.
// With the proxy, requests go to 5173 and the cookie for 3001 isn't sent, so login appears to fail.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for session cookies
});

// --- Mobile web offline queue support (best-effort) ---
// If offline, we can enqueue certain JSON requests and retry later.
// Uploads (multipart) are not queued here.
import { enqueue } from '../mobile/offlineQueue';

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

export async function getServiceProviders(
  category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical' | 'None',
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

export async function compareDocuments(
  v1File: File,
  v2File: File,
  documentId?: string
): Promise<ComparisonResponse> {
  const formData = new FormData();
  formData.append('v1', v1File);
  formData.append('v2', v2File);
  if (documentId) formData.append('documentId', documentId);

  const response = await apiClient.post<ComparisonResponse>('/api/compare', formData, {
    // Do not set Content-Type so browser sets multipart boundary
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


