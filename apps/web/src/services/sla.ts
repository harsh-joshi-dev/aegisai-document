import { DocumentRecord, WorkspaceSettings } from '../mock/types';

export function computeSlaDueAt(nowIso: string, slaHours: number): string {
  const now = new Date(nowIso).getTime();
  return new Date(now + slaHours * 60 * 60 * 1000).toISOString();
}

export function computeEscalationDueAt(slaDueAtIso: string, escalationHours: number): string {
  const sla = new Date(slaDueAtIso).getTime();
  return new Date(sla + escalationHours * 60 * 60 * 1000).toISOString();
}

export function checkSLA(params: {
  tenantId: string;
  nowIso: string;
  settings: WorkspaceSettings;
  documents: DocumentRecord[];
}): { overdue: DocumentRecord[]; toEscalate: DocumentRecord[] } {
  const { tenantId, nowIso, documents } = params;
  const now = new Date(nowIso).getTime();
  const actionable = new Set(['pending', 'review_required', 'pending_info', 'under_review', 'needs_info']);

  const scoped = documents.filter((d) => (d.tenant_id || d.workspaceId) === tenantId);

  const withSla = scoped
    .filter((d) => actionable.has(d.status))
    .filter((d) => !!d.slaDueAt)
    .filter((d) => !d.escalatedAt);

  const overdue = withSla
    .filter((d) => new Date(d.slaDueAt as string).getTime() < now)
    .filter((d) => {
      const escalationDueAt = d.escalationDueAt;
      if (!escalationDueAt) return true;
      return new Date(escalationDueAt).getTime() >= now;
    });

  const toEscalate = withSla
    .filter((d) => {
      const escalationDueAt = d.escalationDueAt;
      if (!escalationDueAt) return false;
      return new Date(escalationDueAt).getTime() < now;
    });

  return { overdue, toEscalate };
}
