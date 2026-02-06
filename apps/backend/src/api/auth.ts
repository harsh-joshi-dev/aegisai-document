import { Router, Request, Response } from 'express';
import passport from '../auth/googleAuth.js';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';

// Extend Express Request type for logout
declare global {
  namespace Express {
    interface Request {
      logout: (callback: (err?: any) => void) => void;
    }
  }
}

const router = Router();

/**
 * Initiate Google OAuth login
 */
router.get(
  '/google',
  (req: Request, res: Response, next) => {
    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'Google OAuth not configured',
        message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file',
      });
    }
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

/**
 * Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_failed`,
    session: true,
  }),
  (req: AuthenticatedRequest, res: Response) => {
    // Successful authentication
    // Redirect directly to upload page (root)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/?auth=success`);
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
