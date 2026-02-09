import { Router, Request, Response, NextFunction } from 'express';
import passport from '../auth/googleAuth.js';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { config } from '../config/env.js';

const router = Router();
const frontendUrl = config.frontendUrl;

/**
 * Initiate Google OAuth login
 */
router.get(
  '/google',
  (req: Request, res: Response, next: NextFunction) => {
    if (!config.google.clientId || !config.google.clientSecret) {
      return res.redirect(
        `${frontendUrl}/login?error=google_not_configured`
      );
    }
    if (config.server.nodeEnv === 'development') {
      console.log('[Auth] Google OAuth: ensure redirect URI in Google Console is exactly:', `${config.backendUrl}/api/auth/google/callback`);
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * Google OAuth callback — always redirect to frontend so user never sees a blank page
 */
router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    (passport.authenticate as (a: string, b: object, c: (err: unknown, user?: AuthenticatedRequest['user']) => void) => (req: Request, res: Response, next: NextFunction) => void)('google', { session: true }, (err: unknown, user: AuthenticatedRequest['user']) => {
      if (err) {
        console.error('[Auth] Google callback error:', err);
        return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }
      if (!user) {
        return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }
      req.login(user, (loginErr: unknown) => {
        if (loginErr) {
          console.error('[Auth] Session login error:', loginErr);
          return res.redirect(`${frontendUrl}/login?error=auth_failed`);
        }
        res.redirect(`${frontendUrl}/?auth=success`);
      });
    })(req, res, next);
  }
);

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
