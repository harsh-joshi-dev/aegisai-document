import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getUserMembershipRole, listUserWorkspaces } from '../db/pgvector.js';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user?.id) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  try {
    const workspaces = await listUserWorkspaces({ userId: authReq.user.id });
    res.json({ success: true, workspaces, count: workspaces.length });
  } catch (e) {
    console.error('List workspaces error:', e);
    res.status(500).json({
      error: 'Failed to list workspaces',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.post('/select', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user?.id) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const { tenantId } = req.body as { tenantId?: string };
  if (!tenantId) {
    return res.status(400).json({ error: 'Invalid request', message: 'tenantId is required' });
  }

  const role = await getUserMembershipRole({ tenantId, userId: authReq.user.id });
  if (!role) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this workspace',
    });
  }

  // Persist selected workspace in session (Option A)
  (req.session as any).selectedTenantId = tenantId;

  res.json({ success: true, tenantId, role });
});

export default router;
