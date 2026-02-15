import { RiskLevelV2 } from '../mock/types';

export interface ApprovalRequirement {
  requiredCount: number;
  requiresAdmin: boolean;
}

/**
 * Compute approval requirements based on risk level
 * 
 * Rules:
 * - SAFE → 1 approval (any reviewer)
 * - REVIEW_REQUIRED → 1 approval (any reviewer)
 * - HIGH → 2 approvals (any reviewers)
 * - CRITICAL → Admin/Owner approval mandatory
 */
export function computeApprovalRequirements(riskLevel: RiskLevelV2): ApprovalRequirement {
  switch (riskLevel) {
    case 'safe':
      return { requiredCount: 1, requiresAdmin: false };
    case 'review':
      return { requiredCount: 1, requiresAdmin: false };
    case 'high':
      return { requiredCount: 2, requiresAdmin: false };
    case 'critical':
      return { requiredCount: 1, requiresAdmin: true };
    default:
      return { requiredCount: 1, requiresAdmin: false };
  }
}

/**
 * Check if approval requirements are met
 */
export function isApprovalRequirementMet(params: {
  riskLevel: RiskLevelV2;
  approvedBy: string[];
  actorRole: 'Owner' | 'Admin' | 'Reviewer' | 'Viewer' | null;
}): { met: boolean; reason?: string } {
  const { riskLevel, approvedBy, actorRole } = params;
  const req = computeApprovalRequirements(riskLevel);

  // Check if enough approvals
  if (approvedBy.length < req.requiredCount) {
    return { met: false, reason: `Requires ${req.requiredCount} approval(s), currently ${approvedBy.length}` };
  }

  // Check if admin approval required
  if (req.requiresAdmin && actorRole !== 'Owner' && actorRole !== 'Admin') {
    return { met: false, reason: 'CRITICAL documents require Admin/Owner approval' };
  }

  return { met: true };
}
