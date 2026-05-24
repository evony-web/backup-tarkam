import { NextResponse } from 'next/server';
import { verifySessionToken, getAdminById, isSessionInvalidated, verifyPlayerSessionToken } from './auth';
import { db } from './db';

/**
 * Verify admin session from request cookies.
 * Works with both NextRequest and standard Request.
 * Returns the admin data if authenticated, or null if not.
 * Checks session invalidation (password change, role change, etc).
 * Sets X-Session-Rotate header when the session token should be refreshed.
 */
export async function verifyAdmin(request: Request): Promise<{ id: string; username: string; role: string; needsRotation?: boolean } | null> {
  // Try NextRequest.cookies first (more reliable with reverse proxies), then fallback to header parsing
  let token: string | null = null;

  // Method 1: NextRequest.cookies API (works when Caddy gateway forwards cookies properly)
  if ('cookies' in request && typeof (request as unknown as { cookies?: { get?: (name: string) => { value: string } | undefined } }).cookies?.get === 'function') {
    const cookieValue = (request as unknown as { cookies: { get: (name: string) => { value: string } | undefined } }).cookies.get('idm-admin-session')?.value;
    if (cookieValue) token = cookieValue;
  }

  // Method 2: Manual header parsing (fallback)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('idm-admin-session='));

    if (sessionCookie) {
      token = decodeURIComponent(sessionCookie.split('=').slice(1).join('='));
    }
  }

  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  const admin = await getAdminById(session.adminId);
  if (!admin) return null;

  // Check session invalidation — reject if token was created before invalidation timestamp
  if (isSessionInvalidated(session.timestamp, admin.sessionInvalidatedAt)) {
    return null;
  }

  return { id: admin.id, username: admin.username, role: admin.role, needsRotation: session.needsRotation };
}

/**
 * Helper to require admin auth in API routes.
 * Returns a response with 401 if not authenticated, or the admin data if authenticated.
 */
export async function requireAdmin(request: Request): Promise<{ id: string; username: string; role: string } | NextResponse> {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized - Admin login required' }, { status: 401 });
  }
  return admin;
}

/**
 * Helper to require super_admin role in API routes.
 * Returns 401 if not authenticated, 403 if not super_admin, or the admin data if authorized.
 */
export async function requireSuperAdmin(request: Request): Promise<{ id: string; username: string; role: string } | NextResponse> {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  if (result.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Forbidden - Super admin access required' },
      { status: 403 }
    );
  }
  return result;
}

/**
 * Verify player session from request cookies.
 * Returns the account data if authenticated, or null if not.
 * Checks session invalidation (password change, security event, etc).
 */
export async function verifyPlayer(request: Request) {
  // Try NextRequest.cookies first, then fallback to header parsing
  let token: string | null = null;

  if ('cookies' in request && typeof (request as unknown as { cookies?: { get?: (name: string) => { value: string } | undefined } }).cookies?.get === 'function') {
    const cookieValue = (request as unknown as { cookies: { get: (name: string) => { value: string } | undefined } }).cookies.get('idm-player-session')?.value;
    if (cookieValue) token = cookieValue;
  }

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('idm-player-session='));

    if (sessionCookie) {
      token = decodeURIComponent(sessionCookie.split('=').slice(1).join('='));
    }
  }

  if (!token) return null;

  const session = verifyPlayerSessionToken(token);
  if (!session) return null;

  const account = await db.account.findUnique({
    where: { id: session.accountId },
    include: {
      player: {
        select: {
          id: true,
          gamertag: true,
          name: true,
          division: true,
          tier: true,
          avatar: true,
        },
      },
    },
  });

  if (!account) return null;

  // Check session invalidation — reject if token was created before invalidation timestamp
  const invalidatedAt = (account as any).sessionInvalidatedAt || null;
  if (isSessionInvalidated(session.timestamp, invalidatedAt)) {
    return null;
  }

  return { id: account.id, username: account.username, playerId: account.playerId, player: account.player };
}

/**
 * Helper to require player auth in API routes.
 * Returns a response with 401 if not authenticated, or the account data if authenticated.
 */
export async function requirePlayer(request: Request): Promise<{ id: string; username: string; playerId: string; player: { id: string; gamertag: string; name: string; division: string; tier: string; avatar: string | null } } | NextResponse> {
  const player = await verifyPlayer(request);
  if (!player) {
    return NextResponse.json({ error: 'Unauthorized - Player login required' }, { status: 401 });
  }
  return player;
}
