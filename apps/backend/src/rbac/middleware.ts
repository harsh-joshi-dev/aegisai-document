/**
 * RBAC Middleware for Express
 */
import { Request, Response, NextFunction } from 'express';
import { Permission, canAccess } from './permissions.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

/**
 * Middleware to check permissions
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = user.role as any;
    const resourceOwnerId = req.body.userId || req.query.userId || req.params.userId;

    if (!canAccess(userRole, permission, resourceOwnerId, user.id)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `You don't have permission to ${permission}`,
      });
    }

    next();
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}
