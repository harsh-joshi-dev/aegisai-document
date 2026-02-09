import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include Passport.js methods
declare global {
  namespace Express {
    interface Request {
      isAuthenticated?: () => boolean;
      user?: {
        id: string;
        email?: string;
        name?: string;
        picture?: string;
        googleId?: string;
        role?: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    googleId?: string;
  };
}

/**
 * Middleware to require authentication
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Check if user is authenticated via Passport.js
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required. Please log in.',
  });
}

/**
 * Middleware to get user from session (optional auth)
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // User might be undefined, that's okay
  next();
}
