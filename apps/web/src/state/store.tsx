import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  ActivityEvent,
  AuditLogEntry,
  DocumentRecord,
  NotificationItem,
  RuleRecord,
  UserRecord,
  WorkspaceSettings,
} from '../mock/types';
import {
  approveDocument as apiApprove,
  getAuditLogs,
  getDocuments,
  rejectDocument as apiReject,
  requestInfo as apiRequestInfo,
  type AuditLogItem,
  type Document as ApiDocument,
} from '../api/client';
import { useAuth } from './auth';
import { useWorkspace } from './workspace';

type StoreState = {
  documents: DocumentRecord[];
  rules: RuleRecord[];
  users: UserRecord[];
  activity: ActivityEvent[];
  settingsByTenant: Record<string, WorkspaceSettings>;
  notifications: NotificationItem[];
  audit: AuditLogEntry[];
};

type StoreActions = {
  refreshDocuments: () => Promise<void>;
  addDocument: (doc: DocumentRecord) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, patch: Partial<DocumentRecord>) => void;
  addRule: (rule: RuleRecord) => void;
  addUser: (user: UserRecord) => void;
  addActivity: (event: ActivityEvent) => void;
  upsertWorkspaceSettings: (settings: WorkspaceSettings) => void;
  notify: (n: Omit<NotificationItem, 'id' | 'ts'> & { ts?: string }) => void;
  markNotificationsRead: (ids: string[]) => void;
  auditLog: (e: Omit<AuditLogEntry, 'id' | 'created_at'> & { created_at?: string }) => void;
  respondToRequestInfo: (documentId: string, actorEmail: string, payload?: { comment?: string; fileName?: string }) => Promise<{ ok: boolean; error?: string }>;
  approveDocument: (documentId: string, actorEmail: string) => Promise<{ ok: boolean; error?: string; approved?: boolean }>;
  rejectDocument: (documentId: string, actorEmail: string, note: string) => Promise<{ ok: boolean; error?: string }>;
  bulkApprove: (docIds: string[], actorEmail: string) => Promise<{ ok: boolean; error?: string }>;
  bulkReject: (docIds: string[], actorEmail: string, note: string) => Promise<{ ok: boolean; error?: string }>;
};

type StoreValue = StoreState & StoreActions;

const StoreContext = createContext<StoreValue | undefined>(undefined);

function mapRiskLevel(level: string | undefined | null): DocumentRecord['riskLevel'] {
  const v = String(level || '').toLowerCase();
  if (v.includes('critical')) return 'Critical';
  if (v.includes('warning')) return 'High';
  if (v.includes('high')) return 'High';
  if (v.includes('review')) return 'Review Required';
  return 'Safe';
}

function mapApprovalStatus(status: string | undefined | null): DocumentRecord['status'] {
  const v = String(status || 'pending').toLowerCase();
  if (v === 'approved') return 'approved';
  if (v === 'rejected') return 'rejected';
  if (v === 'info_requested') return 'pending_info';
  return 'pending';
}

function safeIsoDateOnly(input: unknown): string {
  try {
    const d = new Date(String(input));
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function apiDocToRecord(doc: ApiDocument, workspaceId: string): DocumentRecord {
  const extracted = doc.extractedData || {};
  const vendor =
    (doc.vendorName as string | null | undefined) ||
    (extracted.vendorName as string | undefined) ||
    (extracted.vendor as string | undefined) ||
    (extracted.supplierName as string | undefined) ||
    '—';
  const amountRaw = extracted.totalAmount ?? extracted.amount ?? 0;
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw) || 0;
  const date =
    (extracted.invoiceDate as string | undefined) ||
    (extracted.date as string | undefined) ||
    safeIsoDateOnly(doc.uploadedAt);

  return {
    id: doc.id,
    workspaceId,
    name: doc.filename,
    vendor,
    amount,
    riskLevel: mapRiskLevel(doc.riskLevel),
    riskScore: typeof doc.riskScore === 'number' ? doc.riskScore : Number(doc.riskScore) || 0,
    risk_level: undefined,
    risk_score: undefined,
    status: mapApprovalStatus(doc.approvalStatus),
    date,
    gst: (extracted.vendorGstin as string | undefined) || 'NA',
    summary: doc.summary || '',
    issues: [],
    recommendations: [],
    mismatches: [],
    patternAlerts: [],
  };
}

function toIsoString(ts: unknown): string {
  try {
    const d = new Date(String(ts));
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function actionToMessage(action: string, details: Record<string, any> | undefined): string {
  const a = String(action || '');
  if (a === 'upload') return 'Uploaded document';
  if (a === 'document_uploaded') return 'Uploaded document';
  if (a === 'document_approved') return 'Approved';
  if (a === 'document_rejected') return 'Rejected';
  if (a === 'document_info_requested') return 'Requested info';
  if (a === 'document_renamed') return 'Renamed document';
  if (a.startsWith('document_')) return a.replace('document_', '').replace(/_/g, ' ');
  const note = details?.notes ? ` (${String(details.notes).slice(0, 120)})` : '';
  return `${a}${note}`.trim();
}

function auditLogToActivity(log: AuditLogItem, workspaceId: string): ActivityEvent {
  const ts = toIsoString((log as any).timestamp);
  const action = String((log as any).action || '');
  const details = (log as any).details as Record<string, any> | undefined;
  const actor =
    (log as any).userEmail ||
    (log as any).userName ||
    String((log as any).userId || '');
  const type: ActivityEvent['type'] =
    action === 'document_uploaded'
      ? 'uploaded'
      : action.includes('assigned')
        ? 'assigned'
        : action.includes('status') || action.startsWith('document_')
          ? 'status_changed'
          : 'note';

  return {
    id: String((log as any).id),
    workspaceId,
    ts,
    actorEmail: actor,
    docId: String((log as any).resourceId || ''),
    type,
    message: actionToMessage(action, details),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [state, setState] = useState<StoreState>({
    documents: [],
    rules: [],
    users: [],
    activity: [],
    settingsByTenant: {},
    notifications: [],
    audit: [],
  });

  // Keep a minimal real user list for role checks/UI
  useEffect(() => {
    if (!user?.email) return;
    setState((prev) => {
      const already = prev.users.some((u) => u.email.toLowerCase() === user.email.toLowerCase());
      if (already) return prev;
      return {
        ...prev,
        users: [
          {
            id: user.id,
            name: user.name || 'User',
            email: user.email,
            role: 'Owner',
          },
          ...prev.users,
        ],
      };
    });
  }, [user?.email, user?.id, user?.name]);

  const refreshDocuments = useCallback(async () => {
    // Avoid spamming 401s when not logged in
    if (!user) return;
    if (!activeWorkspace?.id) return;
    const res = await getDocuments();
    const mapped = (res.documents || []).map((d) => apiDocToRecord(d, activeWorkspace.id));
    let activity: ActivityEvent[] = [];
    try {
      const logsRes = await getAuditLogs({ resourceType: 'document', limit: 200, offset: 0 });
      activity = (logsRes.logs || [])
        .map((l) => auditLogToActivity(l, activeWorkspace.id))
        .filter((a) => a.workspaceId === activeWorkspace.id);
    } catch {
      // ignore; activity is best-effort
    }

    setState((prev) => ({ ...prev, documents: mapped, activity }));
  }, [activeWorkspace?.id, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshDocuments();
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, documents: [] }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDocuments]);

  // On logout, clear tenant-scoped state
  useEffect(() => {
    if (user) return;
    setState((prev) => ({ ...prev, documents: [], activity: [] }));
  }, [user]);

  const addDocument: StoreActions['addDocument'] = useCallback((doc) => {
    setState((prev) => ({ ...prev, documents: [doc, ...prev.documents] }));
  }, []);

  const removeDocument: StoreActions['removeDocument'] = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
      activity: (prev.activity || []).filter((a) => a.docId !== id),
    }));
  }, []);

  const updateDocument: StoreActions['updateDocument'] = useCallback((id, patch) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)),
    }));
  }, []);

  const addRule: StoreActions['addRule'] = useCallback((rule) => {
    setState((prev) => ({ ...prev, rules: [rule, ...prev.rules] }));
  }, []);

  const addUser: StoreActions['addUser'] = useCallback((u) => {
    setState((prev) => ({ ...prev, users: [u, ...prev.users] }));
  }, []);

  const addActivity: StoreActions['addActivity'] = useCallback((event) => {
    setState((prev) => ({ ...prev, activity: [event, ...prev.activity].slice(0, 200) }));
  }, []);

  const upsertWorkspaceSettings: StoreActions['upsertWorkspaceSettings'] = useCallback((settings) => {
    setState((prev) => ({
      ...prev,
      settingsByTenant: { ...prev.settingsByTenant, [settings.tenant_id]: settings },
    }));
  }, []);

  const notify: StoreActions['notify'] = useCallback((n) => {
    const ts = n.ts ?? new Date().toISOString();
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ts,
          ...n,
        },
        ...prev.notifications,
      ].slice(0, 200),
    }));
  }, []);

  const markNotificationsRead: StoreActions['markNotificationsRead'] = useCallback((ids) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)),
    }));
  }, []);

  const auditLog: StoreActions['auditLog'] = useCallback((e) => {
    const created_at = e.created_at ?? new Date().toISOString();
    setState((prev) => ({
      ...prev,
      audit: [
        {
          id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          created_at,
          ...e,
        },
        ...prev.audit,
      ].slice(0, 500),
    }));
  }, []);

  const respondToRequestInfo: StoreActions['respondToRequestInfo'] = async (documentId, _actorEmail, payload) => {
    try {
      await apiRequestInfo(documentId, payload?.comment);
      updateDocument(documentId, { status: 'pending_info' });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed to request info' };
    }
  };

  const approveDocument: StoreActions['approveDocument'] = async (documentId) => {
    try {
      await apiApprove(documentId);
      updateDocument(documentId, { status: 'approved' });
      return { ok: true, approved: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Approve failed' };
    }
  };

  const rejectDocument: StoreActions['rejectDocument'] = async (documentId, _actorEmail, note) => {
    try {
      await apiReject(documentId, note);
      updateDocument(documentId, { status: 'rejected' });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Reject failed' };
    }
  };

  const bulkApprove: StoreActions['bulkApprove'] = async (docIds, actorEmail) => {
    try {
      for (const id of docIds) {
        const r = await approveDocument(id, actorEmail);
        if (!r.ok) return { ok: false, error: r.error };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Bulk approve failed' };
    }
  };

  const bulkReject: StoreActions['bulkReject'] = async (docIds, actorEmail, note) => {
    try {
      for (const id of docIds) {
        const r = await rejectDocument(id, actorEmail, note);
        if (!r.ok) return { ok: false, error: r.error };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Bulk reject failed' };
    }
  };

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      refreshDocuments,
      addDocument,
      removeDocument,
      updateDocument,
      addRule,
      addUser,
      addActivity,
      upsertWorkspaceSettings,
      notify,
      markNotificationsRead,
      auditLog,
      respondToRequestInfo,
      approveDocument,
      rejectDocument,
      bulkApprove,
      bulkReject,
    }),
    [
      state,
      refreshDocuments,
      addDocument,
      removeDocument,
      updateDocument,
      addRule,
      addUser,
      addActivity,
      upsertWorkspaceSettings,
      notify,
      markNotificationsRead,
      auditLog,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

