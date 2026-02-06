/**
 * Role-Based Access Control (RBAC) System
 */
export type Role = 'admin' | 'reviewer' | 'viewer' | 'user';

export type Permission = 
  | 'documents:create'
  | 'documents:read'
  | 'documents:update'
  | 'documents:delete'
  | 'documents:analyze'
  | 'rules:create'
  | 'rules:read'
  | 'rules:update'
  | 'rules:delete'
  | 'templates:generate'
  | 'analytics:read'
  | 'compliance:read'
  | 'compliance:export'
  | 'compliance:delete'
  | 'users:manage'
  | 'settings:manage';

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'documents:create',
    'documents:read',
    'documents:update',
    'documents:delete',
    'documents:analyze',
    'rules:create',
    'rules:read',
    'rules:update',
    'rules:delete',
    'templates:generate',
    'analytics:read',
    'compliance:read',
    'compliance:export',
    'compliance:delete',
    'users:manage',
    'settings:manage',
  ],
  reviewer: [
    'documents:create',
    'documents:read',
    'documents:update',
    'documents:analyze',
    'rules:read',
    'templates:generate',
    'analytics:read',
    'compliance:read',
  ],
  viewer: [
    'documents:read',
    'documents:analyze',
    'analytics:read',
  ],
  user: [
    'documents:create',
    'documents:read',
    'documents:analyze',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can perform action on resource
 */
export function canAccess(
  userRole: Role,
  permission: Permission,
  resourceOwnerId?: string,
  userId?: string
): boolean {
  // Admins can access everything
  if (userRole === 'admin') {
    return true;
  }

  // Check permission
  if (!hasPermission(userRole, permission)) {
    return false;
  }

  // If resource has owner, check ownership
  if (resourceOwnerId && userId) {
    // Users can access their own resources
    if (resourceOwnerId === userId) {
      return true;
    }
    // Reviewers and admins can access all resources
    if (userRole === 'reviewer' || userRole === 'admin') {
      return true;
    }
  }

  return true;
}
