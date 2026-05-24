import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════
// IDM LEAGUE — LIGHTWEIGHT MIDDLEWARE
// ═══════════════════════════════════════════════════════════
// CSRF is handled by httpOnly + sameSite=lax cookies (browser-level).
// No Origin validation here — it was crashing Next.js 16.
// ═══════════════════════════════════════════════════════════

export function middleware(_request: NextRequest) {
  // Pass through all requests — auth is handled at route handler level
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
