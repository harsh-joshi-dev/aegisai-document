import { Router, Request, Response } from 'express';
import passport from '../auth/googleAuth.js';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { config } from '../config/env.js';

// Extend Express Request for Passport
declare global {
  namespace Express {
    interface Request {
      logout: (callback: (err?: any) => void) => void;
      login: (user: any, callback: (err?: any) => void) => void;
    }
  }
}

const router = Router();
const frontendUrl = config.frontendUrl;

/**
 * Initiate Google OAuth login
 */
router.get(
  '/google',
  (req: Request, res: Response, next) => {
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
  (req: Request, res: Response) => {
    passport.authenticate('google', { session: true }, (err: any, user: AuthenticatedRequest['user']) => {
      if (err) {
        console.error('[Auth] Google callback error:', err);
        return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }
      if (!user) {
        return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          console.error('[Auth] Session login error:', loginErr);
          return res.redirect(`${frontendUrl}/login?error=auth_failed`);
        }
        res.redirect(`${frontendUrl}/?auth=success`);
      });
    })(req, res);
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
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        error: 'Logout failed',
        message: err.message,
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });
});

export default router;
