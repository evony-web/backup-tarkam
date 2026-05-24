import crypto from 'crypto';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════
// SESSION SECRET — enforce in production
// ═══════════════════════════════════════════════════════════

const _globalSecretKey = '__IDM_SESSION_SECRET__';
function getSessionSecret(): string {
  const g = globalThis as unknown as Record<string, string>;
  if (g[_globalSecretKey]) return g[_globalSecretKey];
  if (process.env.SESSION_SECRET) {
    g[_globalSecretKey] = process.env.SESSION_SECRET;
    return g[_globalSecretKey];
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production. Set it before starting the server.');
  }
  console.warn('⚠️ SESSION_SECRET not set — using dev fallback. NEVER deploy to production without SESSION_SECRET.');
  const fallback = crypto.createHash('sha256').update('idm-league-session-fallback-dev').digest('hex');
  g[_globalSecretKey] = fallback;
  return g[_globalSecretKey];
}

// ═══════════════════════════════════════════════════════════
// PASSWORD UTILITIES
// ═══════════════════════════════════════════════════════════

function hashPasswordSync(password: string, salt: string): string {
  const key = crypto.scryptSync(password, salt, 64);
  return salt + ':' + key.toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return hashPasswordSync(password, salt);
}

export function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isBcryptHash(storedHash)) {
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.compare(password, storedHash);
    } catch {
      return false;
    }
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const key = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key);
}

// ═══════════════════════════════════════════════════════════
// SESSION TOKEN UTILITIES (Admin — HMAC-signed cookie tokens)
// ═══════════════════════════════════════════════════════════

export function createSessionToken(adminId: string, role: string): string {
  const payload = `${adminId}:${role}:${Date.now()}`;
  const signature = sign(payload);
  return `${payload}:${signature}`;
}

export function verifySessionToken(token: string): { adminId: string; role: string; timestamp: number; needsRotation: boolean } | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 4) return null;
    const [adminId, role, timestampStr, signature] = parts;
    const payload = `${adminId}:${role}:${timestampStr}`;
    const expectedSignature = sign(payload);
    if (signature !== expectedSignature) return null;
    const timestamp = parseInt(timestampStr);
    const tokenAge = Date.now() - timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (tokenAge > maxAge) return null;
    // Signal rotation if token is older than half its lifetime (3.5 days)
    const needsRotation = tokenAge > (maxAge / 2);
    return { adminId, role, timestamp, needsRotation };
  } catch {
    return null;
  }
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(data).digest('hex').slice(0, 32);
}

// ═══════════════════════════════════════════════════════════
// PLAYER SESSION TOKEN UTILITIES (HMAC-signed cookie tokens)
// ═══════════════════════════════════════════════════════════

export function createPlayerSessionToken(accountId: string, playerId: string): string {
  const payload = `player:${accountId}:${playerId}:${Date.now()}`;
  const signature = sign(payload);
  return `${payload}:${signature}`;
}

export function verifyPlayerSessionToken(token: string): { accountId: string; playerId: string; timestamp: number } | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 5 || parts[0] !== 'player') return null;
    const [, accountId, playerId, timestampStr, signature] = parts;
    const payload = `player:${accountId}:${playerId}:${timestampStr}`;
    const expectedSignature = sign(payload);
    if (signature !== expectedSignature) return null;
    const timestamp = parseInt(timestampStr);
    const tokenAge = Date.now() - timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (tokenAge > maxAge) return null;
    return { accountId, playerId, timestamp };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// ADMIN DATABASE OPERATIONS
// ═══════════════════════════════════════════════════════════

export async function getAdminByUsername(username: string) {
  return await db.admin.findUnique({ where: { username } });
}

export async function getAdminById(id: string) {
  return await db.admin.findUnique({ where: { id } });
}

export async function createAdmin(username: string, password: string, role: string = 'admin') {
  const passwordHash = await hashPassword(password);
  return db.admin.create({
    data: { username, passwordHash, role },
  });
}

export async function authenticateAdmin(username: string, password: string) {
  const admin = await getAdminByUsername(username);
  if (!admin) return null;
  const isValid = await verifyPassword(password, admin.passwordHash);
  if (!isValid) return null;
  return { id: admin.id, username: admin.username, role: admin.role };
}

// ═══════════════════════════════════════════════════════════
// SESSION INVALIDATION
// ═══════════════════════════════════════════════════════════

/**
 * Invalidate all existing sessions for an admin.
 * Call this when: password change, role change, admin deletion.
 * Any session token created BEFORE this timestamp will be rejected.
 */
export async function invalidateAdminSession(adminId: string): Promise<void> {
  try {
    await db.admin.update({
      where: { id: adminId },
      data: { sessionInvalidatedAt: new Date() },
    });
  } catch (error) {
    console.error('Failed to invalidate admin session:', error);
    // Non-critical: if this fails, old sessions may persist until they expire naturally
  }
}

/**
 * Invalidate all existing sessions for a player account.
 * Call this when: password change, account security event.
 * Any session token created BEFORE this timestamp will be rejected.
 */
export async function invalidatePlayerSession(accountId: string): Promise<void> {
  try {
    await db.account.update({
      where: { id: accountId },
      data: { sessionInvalidatedAt: new Date() },
    });
  } catch (error) {
    console.error('Failed to invalidate player session:', error);
    // Non-critical: if this fails, old sessions may persist until they expire naturally
  }
}

/**
 * Check if a session token was created before the invalidation timestamp.
 * Returns true if the session should be rejected.
 */
export function isSessionInvalidated(
  tokenTimestamp: number,
  invalidatedAt: Date | null
): boolean {
  if (!invalidatedAt) return false;
  return tokenTimestamp < invalidatedAt.getTime();
}

// ═══════════════════════════════════════════════════════════
// COOKIE SESSION PARSING
// ═══════════════════════════════════════════════════════════

const SESSION_COOKIE_NAME = 'idm-admin-session';

export function getSessionFromCookies(cookieHeader: string | null): { username: string; role: string } | null {
  if (!cookieHeader) return null;
  const cookiesMap = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
  const token = cookiesMap[SESSION_COOKIE_NAME];
  if (!token) return null;
  const decodedToken = decodeURIComponent(token);
  const result = verifySessionToken(decodedToken);
  if (!result) return null;
  return { username: result.adminId, role: result.role };
}

// ═══════════════════════════════════════════════════════════
// PERMISSIONS (string-based role system)
// ═══════════════════════════════════════════════════════════

/**
 * DB roles are stored in snake_case (super_admin, admin).
 * Permission system uses UPPER_SNAKE (SUPER_ADMIN, ADMIN).
 * This helper converts DB role to UserRole for permission checks.
 */
export function dbRoleToUserRole(dbRole: string): UserRole {
  const mapping: Record<string, UserRole> = {
    'super_admin': 'SUPER_ADMIN',
    'admin': 'ADMIN',
    'moderator': 'MODERATOR',
    'player': 'PLAYER',
    'user': 'USER',
  };
  return mapping[dbRole] || 'USER';
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'PLAYER' | 'USER';

export interface SessionUser {
  id: string;
  username?: string;
  role: UserRole;
  playerId?: string; // Available for PLAYER role (the Player record ID)
}

export const PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'tournament:create', 'tournament:read', 'tournament:update', 'tournament:delete',
    'team:create', 'team:read', 'team:update', 'team:delete',
    'match:create', 'match:read', 'match:update', 'match:delete',
    'user:read', 'user:update',
    'registration:*', 'bot:*', 'settings:*'
  ],
  MODERATOR: [
    'tournament:read', 'tournament:update',
    'team:read', 'team:update',
    'match:read', 'match:update',
    'registration:update'
  ],
  PLAYER: [
    'tournament:read',
    'team:read', 'team:join',
    'match:read',
    'registration:create', 'registration:read'
  ],
  USER: [
    'tournament:read',
    'team:read',
    'match:read'
  ]
};

export function hasPermission(userRole: UserRole, permission: string): boolean {
  const rolePermissions = PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  if (rolePermissions.includes('*')) return true;
  const [category] = permission.split(':');
  if (rolePermissions.includes(`${category}:*`)) return true;
  return rolePermissions.includes(permission);
}

// ═══════════════════════════════════════════════════════════
// GET SESSION (from cookie-based admin or player tokens)
// ═══════════════════════════════════════════════════════════

export async function getSession(request?: NextRequest): Promise<SessionUser | null> {
  try {
    // Try admin session first
    const adminToken = request?.cookies?.get('idm-admin-session')?.value;
    if (adminToken) {
      const adminSession = verifySessionToken(adminToken);
      if (adminSession) {
        const admin = await getAdminById(adminSession.adminId);
        if (admin) {
          // Check session invalidation (sessionInvalidatedAt may not exist if DB not migrated yet)
          const invalidatedAt = (admin as any).sessionInvalidatedAt || null;
          if (isSessionInvalidated(adminSession.timestamp, invalidatedAt)) {
            return null;
          }
          return {
            id: admin.id,
            username: admin.username,
            role: dbRoleToUserRole(admin.role),
          };
        }
      }
    }

    // Try player session
    const playerToken = request?.cookies?.get('idm-player-session')?.value;
    if (playerToken) {
      const playerSession = verifyPlayerSessionToken(playerToken);
      if (playerSession) {
        const account = await db.account.findUnique({
          where: { id: playerSession.accountId },
          include: { player: true },
        });
        if (account) {
          // Check session invalidation (sessionInvalidatedAt may not exist if DB not migrated yet)
          const invalidatedAt = (account as any).sessionInvalidatedAt || null;
          if (isSessionInvalidated(playerSession.timestamp, invalidatedAt)) {
            return null;
          }
          return {
            id: account.id, // Account ID (consistent with verifyPlayer)
            playerId: account.playerId, // Also expose playerId for convenience
            username: account.username,
            role: 'PLAYER' as UserRole,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// ROUTE MIDDLEWARE HELPERS
// ═══════════════════════════════════════════════════════════

export function withAuth(
  handler: (request: NextRequest, user: SessionUser) => Promise<Response>
) {
  return async (request: NextRequest) => {
    const user = await getSession(request);
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request, user);
  };
}

export function withRole(
  handler: (request: NextRequest, user: SessionUser) => Promise<Response>,
  allowedRoles: UserRole[]
) {
  return async (request: NextRequest) => {
    const user = await getSession(request);
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!allowedRoles.includes(user.role)) {
      return Response.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    return handler(request, user);
  };
}

export function withPermission(
  handler: (request: NextRequest, user: SessionUser) => Promise<Response>,
  permission: string
) {
  return async (request: NextRequest) => {
    const user = await getSession(request);
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(user.role, permission)) {
      return Response.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    return handler(request, user);
  };
}

// ═══════════════════════════════════════════════════════════
// RE-EXPORTS FROM SUB-MODULES
// ═══════════════════════════════════════════════════════════

export { hasAnyPermission, hasAllPermissions, getPermissions, ROLE_HIERARCHY, hasRoleOrHigher, getLowerRoles } from './permissions';
