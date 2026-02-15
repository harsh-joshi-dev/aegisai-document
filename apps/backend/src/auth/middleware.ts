import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

// JWT secret — reuse session secret (or set a dedicated JWT_SECRET env var)
export const JWT_SECRET = process.env.JWT_SECRET || config.server.sessionSecret;

// Extend Express Request user shape (passport provides login, logout, isAuthenticated)
declare global {
  namespace Express {
    interface Request {
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
 * Try to authenticate via Bearer token (JWT).
 * If a valid token is found, sets req.user and returns true.
 */
async function tryBearerAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    if (!payload.userId) return false;

    // Look up user from DB
    const { pool } = await import('../db/pgvector.js');
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) return false;

    const user = result.rows[0] as Record<string, any>;
    req.user = {
      id: String(user.id),
      email: String(user.email ?? ''),
      name: String(user.name ?? ''),
      picture: user.picture ? String(user.picture) : undefined,
      googleId: user.google_id ? String(user.google_id) : undefined,
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware to require authentication.
 * Supports both Passport session auth and JWT Bearer token auth.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // 1. Check Passport session auth first
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  // 2. Fall back to Bearer token auth
  tryBearerAuth(req).then((ok) => {
    if (ok) return next();
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
  }).catch(() => {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
  });
}

/**
 * Middleware to get user from session or token (optional auth)
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // If already authenticated via session, continue
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  // Try bearer token
  tryBearerAuth(req).then(() => next()).catch(() => next());
}
