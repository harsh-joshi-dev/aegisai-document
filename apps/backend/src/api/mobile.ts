import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// Minimal endpoints to support mobile-web "push + biometrics" UX.
// These are intentionally simple stubs so the web app can work end-to-end.

router.post('/push/subscribe', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

  // In production: persist subscription in DB keyed by user.
  // Here: accept and acknowledge.
  const subscription = req.body?.subscription;
  if (!subscription) {
    return res.status(400).json({ success: false, error: 'Missing subscription' });
  }

  return res.json({ success: true });
});

router.post('/webauthn/challenge', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

  // In production: generate cryptographically secure challenge, store in session.
  // For now: simple base64url random-ish string.
  const challenge = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64url');
  return res.json({ success: true, challenge });
});

router.post('/webauthn/verify', requireAuth, async (_req: Request, res: Response) => {
  // In production: verify attestation/assertion.
  // For now: accept and return enabled.
  return res.json({ success: true, enabled: true });
});

export default router;

