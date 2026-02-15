import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { documents as seedDocuments, rules as seedRules, users as seedUsers } from '../mock/data';
import { ActivityEvent, AuditLogEntry, DocumentRecord, NotificationItem, RuleRecord, UserRecord, WorkspaceSettings } from '../mock/types';
import { assignReviewer } from '../services/assignment';
import { checkSLA, computeEscalationDueAt, computeSlaDueAt } from '../services/sla';
import { computeApprovalRequirements, isApprovalRequirementMet } from '../services/approvalRequirements';

interface MockStoreState {
  documents: DocumentRecord[];
  rules: RuleRecord[];
  users: UserRecord[];
  activity: ActivityEvent[];
  settingsByTenant: Record<string, WorkspaceSettings>;
  lastAssignedIndexByTenant: Record<string, number>;
  notifications: NotificationItem[];
  audit: AuditLogEntry[];
}

interface MockStoreActions {
  addDocument: (doc: DocumentRecord) => void;
  updateDocument: (id: string, patch: Partial<DocumentRecord>) => void;
  addRule: (rule: RuleRecord) => void;
  addUser: (user: UserRecord) => void;
  addActivity: (event: ActivityEvent) => void;
  upsertWorkspaceSettings: (settings: WorkspaceSettings) => void;
  notify: (n: Omit<NotificationItem, 'id' | 'ts'> & { ts?: string }) => void;
  markNotificationsRead: (ids: string[]) => void;
  auditLog: (e: Omit<AuditLogEntry, 'id' | 'created_at'> & { created_at?: string }) => void;
  respondToRequestInfo: (documentId: string, actorEmail: string, payload?: { comment?: string; fileName?: string }) => { ok: boolean; error?: string };
  approveDocument: (documentId: string, actorEmail: string) => { ok: boolean; error?: string; approved?: boolean };
  rejectDocument: (documentId: string, actorEmail: string, note: string) => { ok: boolean; error?: string };
  bulkApprove: (docIds: string[], actorEmail: string) => { ok: boolean; error?: string };
  bulkReject: (docIds: string[], actorEmail: string, note: string) => { ok: boolean; error?: string };
}

type MockStoreValue = MockStoreState & MockStoreActions;

const MockStoreContext = createContext<MockStoreValue | undefined>(undefined);

const STORAGE_KEY = 'aegis_mock_store_v1';

function readInitial(): MockStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as MockStoreState;
    if (!parsed?.documents || !parsed?.rules || !parsed?.users) throw new Error('invalid');
    return {
      documents: parsed.documents,
      rules: parsed.rules,
      users: parsed.users,
      activity: (parsed as any).activity ?? [],
      settingsByTenant: (parsed as any).settingsByTenant ?? {},
      lastAssignedIndexByTenant: (parsed as any).lastAssignedIndexByTenant ?? {},
      notifications: (parsed as any).notifications ?? [],
      audit: (parsed as any).audit ?? [],
    };
  } catch {
    return {
      documents: seedDocuments,
      rules: seedRules,
      users: seedUsers,
      activity: [],
      settingsByTenant: {},
      lastAssignedIndexByTenant: {},
      notifications: [],
      audit: [],
    };
  }
}

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockStoreState>(() => readInitial());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nowIso = new Date().toISOString();
      setState((prev) => {
        const tenants = Object.keys(prev.settingsByTenant || {});
        if (!tenants.length) return prev;

        let nextDocs = prev.documents;
        let nextActivity = prev.activity;
        let nextAudit = prev.audit;
        let nextNotifications = prev.notifications;

        for (const tenantId of tenants) {
          const settings = prev.settingsByTenant[tenantId];
          if (!settings) continue;

          const { overdue, toEscalate } = checkSLA({ tenantId, nowIso, settings, documents: nextDocs });

          if (overdue.length) {
            const overdueIds = new Set(overdue.map((d) => d.id));
            nextDocs = nextDocs.map((d) => {
              if (!overdueIds.has(d.id)) return d;
              if (d.overdueAt) return d;
              return { ...d, overdueAt: nowIso, updatedAt: nowIso };
            });

            for (const d of overdue) {
              if (d.overdueAt) continue;
              const overdueActivity: ActivityEvent = {
                id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                workspaceId: d.workspaceId,
                ts: nowIso,
                docId: d.id,
                type: 'note',
                message: 'Document is overdue (SLA breached)',
              };
              nextActivity = [overdueActivity, ...nextActivity].slice(0, 200);

              nextAudit = [
                {
                  id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  tenant_id: tenantId,
                  document_id: d.id,
                  action: 'overdue',
                  created_at: nowIso,
                  metadata: { slaDueAt: d.slaDueAt, escalationDueAt: d.escalationDueAt },
                },
                ...nextAudit,
              ].slice(0, 500);

              // MVP optional: notify reviewer
              if (d.assignedTo) {
                const overdueNotif: NotificationItem = {
                  id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  tenant_id: tenantId,
                  userId: d.assignedTo,
                  ts: nowIso,
                  type: 'info',
                  message: `Overdue: ${d.name} breached SLA`,
                  read: false,
                  docId: d.id,
                };
                nextNotifications = [overdueNotif, ...nextNotifications].slice(0, 200);
              }
            }
          }

          if (toEscalate.length) {
            const ids = new Set(toEscalate.map((d) => d.id));
            nextDocs = nextDocs.map((d) => (ids.has(d.id) ? { ...d, escalatedAt: nowIso, updatedAt: nowIso } : d));

            for (const d of toEscalate) {
              const escalateActivity: ActivityEvent = {
                id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                workspaceId: d.workspaceId,
                ts: nowIso,
                docId: d.id,
                type: 'note',
                message: 'Escalated after exceeding escalation window',
              };
              nextActivity = [escalateActivity, ...nextActivity].slice(0, 200);

              nextAudit = [
                {
                  id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  tenant_id: tenantId,
                  document_id: d.id,
                  action: 'escalated_after_window',
                  created_at: nowIso,
                  metadata: { slaDueAt: d.slaDueAt, escalationDueAt: d.escalationDueAt },
                },
                ...nextAudit,
              ].slice(0, 500);

              const adminTargets = prev.users.filter((u) => u.role === 'Owner' || u.role === 'Admin');
              for (const admin of adminTargets) {
                const escalateNotif: NotificationItem = {
                  id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  tenant_id: tenantId,
                  userId: admin.email,
                  ts: nowIso,
                  type: 'escalation',
                  message: `Escalated: ${d.name} exceeded escalation window`,
                  read: false,
                  docId: d.id,
                };
                nextNotifications = [escalateNotif, ...nextNotifications].slice(0, 200);
              }
            }
          }
        }

        return {
          ...prev,
          documents: nextDocs,
          activity: nextActivity,
          audit: nextAudit,
          notifications: nextNotifications,
        };
      });
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  const value = useMemo<MockStoreValue>(() => {
    const nowIso = () => new Date().toISOString();

    const getActorRole = (email: string | undefined, users: UserRecord[]) => {
      if (!email) return null;
      return users.find((u) => u.email.toLowerCase() === email.toLowerCase())?.role ?? null;
    };

    const canBulkAct = (role: UserRecord['role'] | null) => role === 'Owner' || role === 'Admin';

    const addActivity: MockStoreActions['addActivity'] = (event) => {
      setState((prev) => ({ ...prev, activity: [event, ...prev.activity].slice(0, 200) }));
    };

    const upsertWorkspaceSettings: MockStoreActions['upsertWorkspaceSettings'] = (settings) => {
      setState((prev) => ({
        ...prev,
        settingsByTenant: { ...prev.settingsByTenant, [settings.tenant_id]: settings },
      }));
    };

    const notify: MockStoreActions['notify'] = (n) => {
      setState((prev) => ({
        ...prev,
        notifications: [
          {
            id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ts: n.ts ?? nowIso(),
            ...n,
          },
          ...prev.notifications,
        ].slice(0, 200),
      }));
    };

    const markNotificationsRead: MockStoreActions['markNotificationsRead'] = (ids) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          idSet.has(n.id) ? { ...n, read: true } : n
        ),
      }));
    };

    const auditLog: MockStoreActions['auditLog'] = (e) => {
      setState((prev) => ({
        ...prev,
        audit: [
          {
            id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            created_at: e.created_at ?? nowIso(),
            ...e,
          },
          ...prev.audit,
        ].slice(0, 500),
      }));
    };

    const respondToRequestInfo: MockStoreActions['respondToRequestInfo'] = (documentId, actorEmail, payload) => {
      if (!documentId) return { ok: false, error: 'Missing document id.' };
      if (!actorEmail) return { ok: false, error: 'Missing actor.' };

      const actorRole = getActorRole(actorEmail, state.users);
      if (!actorRole) return { ok: false, error: 'Unknown actor.' };

      const now = nowIso();
      const doc = state.documents.find((d) => d.id === documentId);
      if (!doc) return { ok: false, error: 'Document not found.' };

      const tenant_id = doc.tenant_id || doc.workspaceId;
      const settings = state.settingsByTenant[tenant_id];
      if (!settings) return { ok: false, error: 'Workspace settings missing for tenant.' };

      if (doc.status !== 'pending_info') {
        return { ok: false, error: 'Response allowed only when status is Pending Info.' };
      }

      const nextSlaDueAt = computeSlaDueAt(now, settings.slaHours);
      const nextEscalationDueAt = computeEscalationDueAt(nextSlaDueAt, settings.escalationHours);

      const lastIdx = state.lastAssignedIndexByTenant[tenant_id] ?? -1;
      const assignment = assignReviewer({
        document: doc,
        tenantId: tenant_id,
        users: state.users,
        documents: state.documents,
        settings,
        lastAssignedIndex: lastIdx,
      });

      const reviewerId = assignment.reviewerId;

      setState((prev) => {
        const nextDocs: DocumentRecord[] = prev.documents.map((d) => {
          if (d.id !== documentId) return d;
          return {
            ...d,
            status: 'review_required',
            escalatedAt: undefined,
            overdueAt: undefined,
            slaDueAt: nextSlaDueAt,
            escalationDueAt: nextEscalationDueAt,
            assignedTo: reviewerId ?? d.assignedTo ?? null,
            assignedAt: reviewerId ? now : d.assignedAt,
            updatedAt: now,
          };
        });

        const baseEvents: ActivityEvent[] = [
          {
            id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            workspaceId: doc.workspaceId,
            ts: now,
            actorEmail,
            docId: documentId,
            type: 'note',
            message: 'User responded to request info',
          },
        ];

        if (reviewerId) {
          baseEvents.push({
            id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            workspaceId: doc.workspaceId,
            ts: now,
            actorEmail,
            docId: documentId,
            type: 'assigned',
            message: `Re-assigned to ${reviewerId}`,
          });
        }

        const nextActivity: ActivityEvent[] = [...baseEvents, ...prev.activity].slice(0, 200);

        const auditEntries: AuditLogEntry[] = [
          {
            id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            tenant_id,
            document_id: documentId,
            action: 'request_info_responded',
            performed_by: actorEmail,
            metadata: { comment: payload?.comment, fileName: payload?.fileName },
            created_at: now,
          },
          ...(reviewerId
            ? [
              {
                id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                tenant_id,
                document_id: documentId,
                action: 'reassigned_after_response',
                performed_by: actorEmail,
                metadata: { assignedTo: reviewerId },
                created_at: now,
              } as AuditLogEntry,
            ]
            : []),
        ];

        const notifications: NotificationItem[] = [
          {
            id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            tenant_id,
            userId: actorEmail,
            ts: now,
            type: 'info',
            message: 'Response submitted successfully',
            read: false,
          },
          ...(reviewerId
            ? [
              {
                id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                tenant_id,
                userId: reviewerId,
                ts: now,
                type: 'assign',
                message: `Document requires re-review: ${doc.name}`,
                read: false,
              } as NotificationItem,
            ]
            : []),
        ];

        return {
          ...prev,
          documents: nextDocs,
          activity: nextActivity,
          audit: [...auditEntries, ...prev.audit].slice(0, 500),
          notifications: [...notifications, ...prev.notifications].slice(0, 200),
          lastAssignedIndexByTenant: {
            ...prev.lastAssignedIndexByTenant,
            [tenant_id]: assignment.nextLastAssignedIndex,
          },
        };
      });

      return { ok: true };
    };

    const addDocument: MockStoreActions['addDocument'] = (doc) => {
      const createdAt = doc.createdAt ?? nowIso();
      const updatedAt = doc.updatedAt ?? createdAt;
      const tenant_id = doc.tenant_id ?? doc.workspaceId;

      const settings = state.settingsByTenant[tenant_id] ?? {
        tenant_id,
        assignmentStrategy: 'least_loaded',
        slaHours: 24,
        escalationHours: 48,
      };

      const slaDueAt = doc.slaDueAt ?? computeSlaDueAt(createdAt, settings.slaHours);
      const escalationDueAt = doc.escalationDueAt ?? computeEscalationDueAt(slaDueAt, settings.escalationHours);

      const lastIdx = state.lastAssignedIndexByTenant[tenant_id] ?? -1;
      const assignment = assignReviewer({
        document: doc,
        tenantId: tenant_id,
        users: state.users,
        documents: state.documents,
        settings,
        lastAssignedIndex: lastIdx,
      });

      const assignedTo = assignment.reviewerId;
      const assignedAt = assignedTo ? nowIso() : undefined;

      const riskLevel = doc.risk_level ?? 'review';
      const approvalReq = computeApprovalRequirements(riskLevel);

      const normalized: DocumentRecord = {
        ...doc,
        tenant_id,
        createdAt,
        updatedAt,
        risk_score: doc.risk_score ?? doc.riskScore,
        risk_level: riskLevel,
        requiredApprovals: doc.requiredApprovals ?? approvalReq.requiredCount,
        approvedBy: doc.approvedBy ?? [],
        slaDueAt,
        escalationDueAt,
        assignedTo: doc.assignedTo ?? assignedTo,
        assignedAt: doc.assignedAt ?? assignedAt,
      };

      setState((prev) => ({
        ...prev,
        documents: [normalized, ...prev.documents],
        lastAssignedIndexByTenant: {
          ...prev.lastAssignedIndexByTenant,
          [tenant_id]: assignment.nextLastAssignedIndex,
        },
      }));
      addActivity({
        id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        workspaceId: doc.workspaceId,
        ts: nowIso(),
        actorEmail: doc.createdBy || undefined,
        docId: doc.id,
        type: 'uploaded',
        message: `Uploaded ${doc.name}`,
      });

      auditLog({
        tenant_id,
        document_id: doc.id,
        action: 'uploaded',
        performed_by: doc.createdBy || undefined,
        metadata: { name: doc.name, type: doc.docType ?? doc.type },
      });

      if (assignedTo) {
        addActivity({
          id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          workspaceId: doc.workspaceId,
          ts: nowIso(),
          actorEmail: doc.createdBy || undefined,
          docId: doc.id,
          type: 'assigned',
          message: `Assigned to ${assignedTo}`,
        });

        auditLog({
          tenant_id,
          document_id: doc.id,
          action: 'assigned',
          performed_by: doc.createdBy || undefined,
          metadata: { assignedTo },
        });

        notify({
          tenant_id,
          userId: assignedTo,
          type: 'assign',
          message: `New document assigned: ${doc.name}`,
          docId: doc.id,
        });
      }
    };

    const updateDocument: MockStoreActions['updateDocument'] = (id, patch) => {
      setState((prev) => {
        const current = prev.documents.find((d) => d.id === id);
        const now = nowIso();
        const nextDocs = prev.documents.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now } : d));

        if (current) {
          const tenant_id = current.tenant_id || current.workspaceId;
          const nextStatus = patch.status ?? current.status;
          if (patch.status && patch.status !== current.status) {
            const statusLabel = nextStatus.replace('_', ' ');
            const actorEmail = (patch as any).actorEmail as string | undefined;
            const ev: ActivityEvent = {
              id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              workspaceId: current.workspaceId,
              ts: now,
              actorEmail,
              docId: current.id,
              type: 'status_changed',
              message: `Status → ${statusLabel}`,
            };

            const aud: AuditLogEntry = {
              id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              tenant_id,
              document_id: current.id,
              action: `status_changed:${nextStatus}`,
              performed_by: actorEmail,
              metadata: { from: current.status, to: nextStatus },
              created_at: now,
            };

            // Notifications (MVP)
            const notifyItems: NotificationItem[] = [];
            if (nextStatus === 'pending_info') {
              if (current.assignedTo) {
                notifyItems.push({
                  id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  tenant_id,
                  userId: current.assignedTo,
                  ts: now,
                  type: 'request_info',
                  message: `Info requested: ${current.name}`,
                  read: false,
                });
              }
            }

            return {
              ...prev,
              documents: nextDocs,
              activity: [ev, ...prev.activity].slice(0, 200),
              audit: [aud, ...prev.audit].slice(0, 500),
              notifications: notifyItems.length ? [...notifyItems, ...prev.notifications].slice(0, 200) : prev.notifications,
            };
          }

          if (typeof patch.assignedTo !== 'undefined' && patch.assignedTo !== current.assignedTo) {
            const actorEmail = (patch as any).actorEmail as string | undefined;
            const ev: ActivityEvent = {
              id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              workspaceId: current.workspaceId,
              ts: now,
              actorEmail,
              docId: current.id,
              type: 'assigned',
              message: `Assigned to ${patch.assignedTo || 'Unassigned'}`,
            };

            const aud: AuditLogEntry = {
              id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              tenant_id,
              document_id: current.id,
              action: 'assigned',
              performed_by: actorEmail,
              metadata: { from: current.assignedTo || null, to: patch.assignedTo || null },
              created_at: now,
            };

            const notifyItems: NotificationItem[] = [];
            if (patch.assignedTo) {
              notifyItems.push({
                id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                tenant_id,
                userId: patch.assignedTo,
                ts: now,
                type: 'assign',
                message: `New document assigned: ${current.name}`,
                read: false,
              });
            }

            return {
              ...prev,
              documents: nextDocs,
              activity: [ev, ...prev.activity].slice(0, 200),
              audit: [aud, ...prev.audit].slice(0, 500),
              notifications: notifyItems.length ? [...notifyItems, ...prev.notifications].slice(0, 200) : prev.notifications,
            };
          }
        }

        return { ...prev, documents: nextDocs };
      });
    };

    const addRule: MockStoreActions['addRule'] = (rule) => {
      setState((prev) => ({ ...prev, rules: [rule, ...prev.rules] }));
      addActivity({
        id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        workspaceId: 'harsh',
        ts: new Date().toISOString(),
        type: 'rule_created',
        message: `Created rule: ${rule.name}`,
      });
    };

    const addUser: MockStoreActions['addUser'] = (user) => {
      setState((prev) => ({ ...prev, users: [user, ...prev.users] }));
      addActivity({
        id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        workspaceId: 'harsh',
        ts: new Date().toISOString(),
        type: 'user_invited',
        message: `Invited ${user.name} (${user.role})`,
      });
    };

    const approveDocument: MockStoreActions['approveDocument'] = (documentId, actorEmail) => {
      const doc = state.documents.find((d) => d.id === documentId);
      if (!doc) return { ok: false, error: 'Document not found.' };

      const role = getActorRole(actorEmail, state.users);
      const riskLevel = doc.risk_level ?? 'review';
      const currentApprovals = doc.approvedBy ?? [];
      const newApprovals = currentApprovals.includes(actorEmail) ? currentApprovals : [...currentApprovals, actorEmail];
      const required = doc.requiredApprovals ?? computeApprovalRequirements(riskLevel).requiredCount;

      const isMet = isApprovalRequirementMet({ riskLevel, approvedBy: newApprovals, actorRole: role });
      if (!isMet.met && isMet.reason) {
        // Still record the approval but don't finalize
        if (currentApprovals.includes(actorEmail)) {
          return { ok: false, error: 'You have already approved this document.' };
        }
      }

      const now = new Date().toISOString();
      const tenant_id = doc.tenant_id || doc.workspaceId;
      const finalStatus = isMet.met ? ('approved' as const) : doc.status;

      setState((prev) => {
        const nextDocs = prev.documents.map((d) =>
          d.id === documentId ? { ...d, approvedBy: newApprovals, status: finalStatus, updatedAt: now } : d
        );

        const ev: ActivityEvent = {
          id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          workspaceId: doc.workspaceId,
          ts: now,
          actorEmail,
          docId: doc.id,
          type: 'status_changed',
          message: isMet.met ? 'Approved (requirements met)' : `Approval recorded (${newApprovals.length}/${required})`,
        };

        const aud: AuditLogEntry = {
          id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          tenant_id,
          document_id: doc.id,
          action: isMet.met ? 'approved' : 'approval_recorded',
          performed_by: actorEmail,
          metadata: { approvedBy: newApprovals, requiredApprovals: required },
          created_at: now,
        };

        return {
          ...prev,
          documents: nextDocs,
          activity: [ev, ...prev.activity].slice(0, 200),
          audit: [aud, ...prev.audit].slice(0, 500),
        };
      });

      return { ok: true, approved: isMet.met };
    };

    const rejectDocument: MockStoreActions['rejectDocument'] = (documentId, actorEmail, note) => {
      const trimmed = note.trim();
      if (!trimmed) return { ok: false, error: 'Reject note is required.' };

      const doc = state.documents.find((d) => d.id === documentId);
      if (!doc) return { ok: false, error: 'Document not found.' };

      const now = new Date().toISOString();
      const tenant_id = doc.tenant_id || doc.workspaceId;

      setState((prev) => {
        const nextDocs = prev.documents.map((d) =>
          d.id === documentId ? { ...d, status: 'rejected' as const, updatedAt: now } : d
        );

        const ev: ActivityEvent = {
          id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          workspaceId: doc.workspaceId,
          ts: now,
          actorEmail,
          docId: doc.id,
          type: 'status_changed',
          message: `Rejected: ${trimmed}`,
        };

        const aud: AuditLogEntry = {
          id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          tenant_id,
          document_id: doc.id,
          action: 'rejected',
          performed_by: actorEmail,
          metadata: { note: trimmed },
          created_at: now,
        };

        return {
          ...prev,
          documents: nextDocs,
          activity: [ev, ...prev.activity].slice(0, 200),
          audit: [aud, ...prev.audit].slice(0, 500),
        };
      });

      return { ok: true };
    };

    const bulkApprove: MockStoreActions['bulkApprove'] = (docIds, actorEmail) => {
      if (!docIds.length) return { ok: false, error: 'No documents selected.' };

      const role = getActorRole(actorEmail, state.users);
      if (!canBulkAct(role)) return { ok: false, error: 'Only Owner/Admin can perform bulk actions.' };

      const selected = state.documents.filter((d) => docIds.includes(d.id));
      const actionable = new Set<DocumentRecord['status']>(['pending', 'review_required', 'pending_info', 'under_review', 'needs_info']);
      if (selected.some((d) => !actionable.has(d.status))) {
        return { ok: false, error: 'Bulk approval allowed only for actionable statuses.' };
      }

      // Check CRITICAL risk requires admin
      const hasCritical = selected.some((d) => d.risk_level === 'critical');
      if (hasCritical && role !== 'Owner' && role !== 'Admin') {
        return { ok: false, error: 'CRITICAL documents require Admin/Owner approval.' };
      }

      const now = new Date().toISOString();
      setState((prev) => {
        const docs: DocumentRecord[] = prev.documents.map((d) => {
          if (!docIds.includes(d.id)) return d;

          const riskLevel = d.risk_level ?? 'review';
          const currentApprovals = d.approvedBy ?? [];
          const newApprovals = currentApprovals.includes(actorEmail) ? currentApprovals : [...currentApprovals, actorEmail];

          const isMet = isApprovalRequirementMet({ riskLevel, approvedBy: newApprovals, actorRole: role });
          const finalStatus = isMet.met ? ('approved' as const) : d.status;

          return { ...d, approvedBy: newApprovals, status: finalStatus, updatedAt: now };
        });

        const events: ActivityEvent[] = selected.map((d) => {
          const riskLevel = d.risk_level ?? 'review';
          const currentApprovals = d.approvedBy ?? [];
          const newApprovals = currentApprovals.includes(actorEmail) ? currentApprovals : [...currentApprovals, actorEmail];
          const required = d.requiredApprovals ?? computeApprovalRequirements(riskLevel).requiredCount;
          const isMet = isApprovalRequirementMet({ riskLevel, approvedBy: newApprovals, actorRole: role });

          return {
            id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            workspaceId: d.workspaceId,
            ts: now,
            actorEmail,
            docId: d.id,
            type: 'status_changed',
            message: isMet.met ? 'Approved (requirements met)' : `Approval recorded (${newApprovals.length}/${required})`,
          };
        });

        const audits: AuditLogEntry[] = selected.map((d) => {
          const tenant_id = d.tenant_id || d.workspaceId;
          const riskLevel = d.risk_level ?? 'review';
          const currentApprovals = d.approvedBy ?? [];
          const newApprovals = currentApprovals.includes(actorEmail) ? currentApprovals : [...currentApprovals, actorEmail];
          const isMet = isApprovalRequirementMet({ riskLevel, approvedBy: newApprovals, actorRole: role });

          return {
            id: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            tenant_id,
            document_id: d.id,
            action: isMet.met ? 'approved' : 'approval_recorded',
            performed_by: actorEmail,
            metadata: { approvedBy: newApprovals, requiredApprovals: d.requiredApprovals },
            created_at: now,
          };
        });

        return { ...prev, documents: docs, activity: [...events, ...prev.activity].slice(0, 200), audit: [...audits, ...prev.audit].slice(0, 500) };
      });

      return { ok: true };
    };

    const bulkReject: MockStoreActions['bulkReject'] = (docIds, actorEmail, note) => {
      const trimmed = note.trim();
      if (!docIds.length) return { ok: false, error: 'No documents selected.' };
      if (!trimmed) return { ok: false, error: 'Reject note is required.' };

      const role = getActorRole(actorEmail, state.users);
      if (!canBulkAct(role)) return { ok: false, error: 'Only Owner/Admin can perform bulk actions.' };

      const selected = state.documents.filter((d) => docIds.includes(d.id));
      const actionable = new Set<DocumentRecord['status']>(['pending', 'under_review', 'needs_info']);
      if (selected.some((d) => !actionable.has(d.status))) {
        return { ok: false, error: 'Bulk rejection allowed only for Pending / Under Review / Needs Info.' };
      }
      const now = new Date().toISOString();

      setState((prev) => {
        const docs: DocumentRecord[] = prev.documents.map((d) =>
          docIds.includes(d.id)
            ? { ...d, status: 'rejected' as DocumentRecord['status'] }
            : d
        );
        const events: ActivityEvent[] = selected.flatMap((d) => [
          {
            id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            workspaceId: d.workspaceId,
            ts: now,
            actorEmail,
            docId: d.id,
            type: 'status_changed',
            message: 'Status → Rejected (bulk)',
          },
          {
            id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            workspaceId: d.workspaceId,
            ts: now,
            actorEmail,
            docId: d.id,
            type: 'note',
            message: `Bulk reject note: ${trimmed}`,
          },
        ]);

        return { ...prev, documents: docs, activity: [...events, ...prev.activity].slice(0, 200) };
      });

      return { ok: true };
    };

    return {
      documents: state.documents,
      rules: state.rules,
      users: state.users,
      activity: state.activity ?? [],
      settingsByTenant: state.settingsByTenant,
      lastAssignedIndexByTenant: state.lastAssignedIndexByTenant,
      notifications: state.notifications,
      audit: state.audit,
      addDocument,
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
    };
  }, [state]);

  return <MockStoreContext.Provider value={value}>{children}</MockStoreContext.Provider>;
}

export function useMockStore() {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error('useMockStore must be used within MockStoreProvider');
  return ctx;
}
