import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, isSessionInvalidated, getAdminById } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const token = request.cookies.get('idm-admin-session')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { headers });
    }

    // Use the proper auth module for verification (handles HMAC + session invalidation)
    const session = verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { headers });
    }

    // Look up admin from database to get the real username (not just the ID)
    const admin = await getAdminById(session.adminId);
    if (!admin) {
      return NextResponse.json({ authenticated: false }, { headers });
    }

    // Check session invalidation (password change, role change, etc.)
    if (isSessionInvalidated(session.timestamp, admin.sessionInvalidatedAt)) {
      return NextResponse.json({ authenticated: false }, { headers });
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: admin.id,
        username: admin.username,  // Real username from DB, not the ID
        role: admin.role,
      },
    }, { headers });
  } catch {
    return NextResponse.json({ authenticated: false }, { headers });
  }
}
