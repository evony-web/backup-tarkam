/**
 * Permission definitions for Role-Based Access Control
 * Each role has a set of permissions that define what actions they can perform
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'PLAYER' | 'USER'
export type Permission = string

export const PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ['*'], // All permissions
  
  ADMIN: [
    'tournament:create',
    'tournament:read',
    'tournament:update',
    'tournament:delete',
    'tournament:publish',
    'team:create',
    'team:read',
    'team:update',
    'team:delete',
    'match:create',
    'match:read',
    'match:update',
    'match:delete',
    'user:read',
    'user:update',
    'participant:approve',
    'participant:reject',
    'bracket:generate',
    'bracket:update',
  ],
  
  MODERATOR: [
    'tournament:read',
    'tournament:update',
    'team:read',
    'team:update',
    'match:read',
    'match:update',
    'participant:read',
    'bracket:read',
    'bracket:update',
  ],
  
  PLAYER: [
    'tournament:read',
    'team:read',
    'team:join',
    'team:create',
    'team:leave',
    'match:view',
    'match:score',
    'registration:create',
    'registration:read',
    'registration:cancel',
  ],
  
  USER: [
    'tournament:read',
    'team:read',
    'match:view',
    'profile:read',
    'profile:update',
  ],
}

/**
 * Check if a role has a specific permission
 * Supports wildcard permissions (e.g., '*' or 'tournament:*')
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = PERMISSIONS[role]
  
  // Check for wildcard permission
  if (rolePermissions.includes('*')) {
    return true
  }
  
  // Check for exact permission match
  if (rolePermissions.includes(permission)) {
    return true
  }
  
  // Check for wildcard category permission (e.g., 'tournament:*')
  const [category] = permission.split(':')
  if (rolePermissions.includes(`${category}:*`)) {
    return true
  }
  
  return false
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: UserRole): Permission[] {
  return PERMISSIONS[role]
}

/**
 * Role hierarchy for comparison
 * Higher number = more privileges
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  MODERATOR: 60,
  PLAYER: 40,
  USER: 20,
}

/**
 * Check if a role has equal or higher privilege than another role
 */
export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Get all roles that are equal or lower in hierarchy
 */
export function getLowerRoles(role: UserRole): UserRole[] {
  const hierarchyValue = ROLE_HIERARCHY[role]
  return (Object.keys(ROLE_HIERARCHY) as UserRole[]).filter(
    r => ROLE_HIERARCHY[r] <= hierarchyValue
  )
}
