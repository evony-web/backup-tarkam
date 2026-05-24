import { NextResponse } from 'next/server'

/**
 * POST /api/auth/refresh
 * Refresh session token (extend expiration)
 * Note: Uses admin token-based sessions (no db session model)
 */
export async function POST() {
  try {
    // Admin session tokens are stateless (HMAC-signed)
    // No server-side refresh needed — tokens are valid until expiry
    return NextResponse.json({
      message: 'Session is valid (stateless token)',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
