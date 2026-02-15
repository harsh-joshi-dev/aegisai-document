import { DocumentRecord, UserRecord, WorkspaceSettings } from '../mock/types';

export type AssignmentStrategy = WorkspaceSettings['assignmentStrategy'];

export function assignReviewer(params: {
  document: DocumentRecord;
  tenantId: string;
  users: UserRecord[];
  documents: DocumentRecord[];
  settings: WorkspaceSettings;
  lastAssignedIndex: number;
}): { reviewerId: string | null; nextLastAssignedIndex: number } {
  const { tenantId, users, documents, settings } = params;

  const reviewers = users.filter((u) => u.role === 'Reviewer');
  if (!reviewers.length) return { reviewerId: null, nextLastAssignedIndex: params.lastAssignedIndex };

  const strategy: AssignmentStrategy = settings.assignmentStrategy;

  if (strategy === 'default') {
    const found = settings.defaultReviewerId;
    const exists = found && reviewers.some((r) => r.email === found);
    return { reviewerId: exists ? found! : reviewers[0].email, nextLastAssignedIndex: params.lastAssignedIndex };
  }

  if (strategy === 'first') {
    return { reviewerId: reviewers[0].email, nextLastAssignedIndex: params.lastAssignedIndex };
  }

  if (strategy === 'round_robin') {
    const last = Number.isFinite(params.lastAssignedIndex) ? params.lastAssignedIndex : -1;
    const next = (last + 1) % reviewers.length;
    return { reviewerId: reviewers[next].email, nextLastAssignedIndex: next };
  }

  // least_loaded
  const activeStatuses = new Set(['pending', 'review_required', 'pending_info', 'under_review', 'needs_info']);

  const loads = reviewers.map((r) => {
    const count = documents.filter((d) => (d.tenant_id || d.workspaceId) === tenantId)
      .filter((d) => activeStatuses.has(d.status))
      .filter((d) => d.assignedTo === r.email).length;
    return { reviewer: r, count };
  });

  loads.sort((a, b) => a.count - b.count || a.reviewer.email.localeCompare(b.reviewer.email));
  return { reviewerId: loads[0].reviewer.email, nextLastAssignedIndex: params.lastAssignedIndex };
}
