import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from './permissions'
import { verifySessionToken, verifyPlayerSessionToken, getAdminById, isSessionInvalidated } from './index'
import { hasPermission, hasRoleOrHigher } from './permissions'
import { db } from '@/lib/db'

/**
 * Auth context passed to protected route handlers
 */
export interface AuthContext {
  userId: string
  userRole: UserRole
  username?: string
}

/**
 * Options for withAuth middleware
 */
export interface WithAuthOptions {
  /** Required role to access the route */
  requiredRole?: UserRole
  /** Required permissions to access the route */
  requiredPermissions?: string[]
  /** Allow access if user has any of these roles */
  allowedRoles?: UserRole[]
}

/**
 * Extended NextRequest with auth context
 */
export interface AuthenticatedRequest extends NextRequest {
  auth?: AuthContext
}

/**
 * API Route handler type
 */
type RouteHandler = (
  request: AuthenticatedRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse

/**
 * Get auth context from request (cookie-based admin or player tokens ONLY).
 * Bearer token acceptance has been removed for security — session tokens
 * should only be sent via httpOnly cookies, not Authorization headers.
 */
async function getAuthFromRequest(request: NextRequest): Promise<AuthContext | null> {
  try {
    // Try admin session first
    const adminToken = request.cookies.get('idm-admin-session')?.value
    if (adminToken) {
      const session = verifySessionToken(adminToken)
      if (session) {
        const admin = await getAdminById(session.adminId)
        if (admin) {
          // Check session invalidation
          if (isSessionInvalidated(session.timestamp, admin.sessionInvalidatedAt)) {
            return null
          }
          return {
            userId: admin.id,
            username: admin.username,
            userRole: admin.role as UserRole,
          }
        }
      }
    }

    // Try player session
    const playerToken = request.cookies.get('idm-player-session')?.value
    if (playerToken) {
      const session = verifyPlayerSessionToken(playerToken)
      if (session) {
        const account = await db.account.findUnique({
          where: { id: session.accountId },
          include: { player: true },
        })
        if (account) {
          return {
            userId: account.playerId,
            username: account.username,
            userRole: 'PLAYER' as UserRole,
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Middleware wrapper to protect routes with authentication
 */
export function withAuth(
  handler: RouteHandler,
  options: WithAuthOptions = {}
): RouteHandler {
  return async (request: AuthenticatedRequest, context) => {
    try {
      const auth = await getAuthFromRequest(request)

      if (!auth) {
        return NextResponse.json(
          { error: 'Authentication required', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }

      // Check role requirements
      if (options.requiredRole) {
        if (!hasRoleOrHigher(auth.userRole, options.requiredRole)) {
          return NextResponse.json(
            { error: 'Insufficient role privileges', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
      }

      // Check allowed roles
      if (options.allowedRoles && options.allowedRoles.length > 0) {
        if (!options.allowedRoles.includes(auth.userRole)) {
          return NextResponse.json(
            { error: 'Role not allowed', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
      }

      // Check permission requirements
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const hasAllPerms = options.requiredPermissions.every(
          permission => hasPermission(auth.userRole, permission)
        )

        if (!hasAllPerms) {
          return NextResponse.json(
            { error: 'Insufficient permissions', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
      }

      // Add auth context to request
      request.auth = auth

      return handler(request, context)
    } catch (error) {
      console.error('Auth middleware error:', error)
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware wrapper for role-based access control
 */
export function withRole(
  handler: RouteHandler,
  roles: UserRole[]
): RouteHandler {
  return withAuth(handler, { allowedRoles: roles })
}

/**
 * Middleware for admin-only routes
 */
export function withAdmin(handler: RouteHandler): RouteHandler {
  return withAuth(handler, { allowedRoles: ['SUPER_ADMIN', 'ADMIN'] })
}

/**
 * Middleware for super admin only routes
 */
export function withSuperAdmin(handler: RouteHandler): RouteHandler {
  return withAuth(handler, { allowedRoles: ['SUPER_ADMIN'] })
}

/**
 * Get current session from request (for use in route handlers)
 */
export async function getSession(request: NextRequest): Promise<AuthContext | null> {
  return getAuthFromRequest(request)
}

/**
 * Get optional session (doesn't throw if not authenticated)
 */
export async function getOptionalSession(request: NextRequest): Promise<AuthContext | null> {
  return getAuthFromRequest(request)
}

/**
 * Require authentication and return user or throw error
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const session = await getAuthFromRequest(request)

  if (!session) {
    throw new Error('Authentication required')
  }

  return session
}

/**
 * Check if user can perform action on a resource
 */
export function canPerformAction(
  userRole: UserRole,
  action: string,
  resourceOwnerId?: string,
  currentUserId?: string
): boolean {
  // If user owns the resource, they can always perform actions on it
  if (resourceOwnerId && currentUserId && resourceOwnerId === currentUserId) {
    return true
  }

  // Otherwise, check permissions
  return hasPermission(userRole, action)
}
