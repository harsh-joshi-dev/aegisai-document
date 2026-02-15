import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Router, Request, Response, NextFunction } from 'express';
import passport from '../auth/googleAuth.js';
import { requireAuth, AuthenticatedRequest, JWT_SECRET } from '../auth/middleware.js';
import { config } from '../config/env.js';

const router = Router();
const frontendUrl = config.frontendUrl;

// ── One-time auth tokens ────────────────────────────────────────────
// After Google OAuth, the backend generates a short-lived token and
// redirects to the frontend with it.  The frontend then exchanges the
// token for a real session via the Vite proxy (same origin), which
// means the session cookie is set on the correct origin.
const pendingTokens = new Map<string, { userId: string; expiresAt: number }>();

function generateAuthToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  // Token expires in 60 seconds — plenty of time for the redirect + exchange
  pendingTokens.set(token, { userId, expiresAt: Date.now() + 60_000 });
  return token;
}

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingTokens) {
    if (data.expiresAt < now) pendingTokens.delete(token);
  }
}, 5 * 60_000);

/**
 * Initiate Google OAuth login
 */
router.get(
  '/google',
  (req: Request, res: Response, next: NextFunction) => {
    if (!config.google.clientId || !config.google.clientSecret) {
      return res.redirect(
        `${frontendUrl}/auth?error=google_not_configured`
      );
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * Google OAuth callback — generate one-time token and redirect to frontend
 */
router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    (passport.authenticate as any)('google', { session: false }, (err: unknown, user: any) => {
      if (err) {
        console.error('[Auth] Google callback error:', err);
        return res.redirect(`${frontendUrl}/auth?error=auth_failed`);
      }
      if (!user) {
        return res.redirect(`${frontendUrl}/auth?error=auth_failed`);
      }
      // Generate a one-time token instead of setting a session cookie here
      const token = generateAuthToken(user.id);
      console.log('[Auth] Generated auth token for user:', user.id);
      res.redirect(`${frontendUrl}/dashboard?auth_token=${token}`);
    })(req, res, next);
  }
);

/**
 * Exchange a one-time auth token for a session (called from frontend via proxy)
 */
router.post('/token-exchange', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const data = pendingTokens.get(token);
  if (!data) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Token is single-use
  pendingTokens.delete(token);

  if (data.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Look up the user and establish a session
  try {
    const { pool } = await import('../db/pgvector.js');
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [data.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0] as Record<string, any>;

    // Generate a long-lived JWT for the frontend to use as Bearer token
    const jwtToken = jwt.sign(
      { userId: String(user.id) },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[Auth] Token exchange successful for user:', user.id);
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error('[Auth] Token exchange error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Get current user
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      picture: req.user!.picture,
    },
  });
});

/**
 * Logout
 */
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err: unknown) => {
    if (err) {
      return res.status(500).json({
        error: 'Logout failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });
});

export default router;
