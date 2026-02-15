import { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware.js';
import { getDefaultTenant } from '../whiteLabel/tenant.js';
import { ensureTenantMembership, getUserMembershipRole, listUserWorkspaces } from '../db/pgvector.js';

declare module 'express-session' {
  interface SessionData {
    selectedTenantId?: string;
  }
}

export type WorkspaceRole = 'owner' | 'admin' | 'reviewer' | 'viewer';

export type WorkspaceContext = {
  tenantId: string;
  role: WorkspaceRole;
};

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspace?: WorkspaceContext;
}

export async function requireWorkspaceContext(req: WorkspaceRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    // Option A: selected workspace in session (primary)
    const fromSession = (req.session as any)?.selectedTenantId as string | undefined;

    // Future Option B: subdomain resolution can be added here later
    const tenantId = fromSession || null;

    const selectedTenant = tenantId ? { id: tenantId } : await getDefaultTenant();

    // Bootstrap ONLY when user has no workspaces yet (first login)
    const existing = await listUserWorkspaces({ userId: req.user.id });
    if (existing.length === 0) {
      await ensureTenantMembership({ tenantId: selectedTenant.id, userId: req.user.id, role: 'owner' });
    }

    const role = await getUserMembershipRole({ tenantId: selectedTenant.id, userId: req.user.id });
    if (!role) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this workspace',
      });
    }

    req.workspace = {
      tenantId: selectedTenant.id,
      role,
    };

    next();
  } catch (e) {
    console.error('Workspace context error:', e);
    res.status(500).json({ error: 'Failed to resolve workspace context' });
  }
}

export function requireWorkspaceRole(allowed: WorkspaceRole[]) {
  return (req: WorkspaceRequest, res: Response, next: NextFunction) => {
    const role = req.workspace?.role;
    if (!role) {
      return res.status(500).json({ error: 'Workspace context missing' });
    }
    if (!allowed.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${allowed.join(' or ')}`,
      });
    }
    next();
  };
}
