import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════
// IDM LEAGUE — MIDDLEWARE (Security Headers + Rate Limiting)
// ═══════════════════════════════════════════════════════════
// 1. Security headers on ALL responses (CSP, X-Content-Type-Options, etc.)
// 2. Rate limiting on mutation API endpoints (POST/PUT/DELETE/PATCH)
// 3. CSRF protection: Origin header validation on mutations
// ═══════════════════════════════════════════════════════════

// ── In-memory rate limiter (per function instance) ──
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // 30 requests
const RATE_WINDOW = 60_000; // per 60 seconds

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return true;
  }
  return false;
}

// Pre-computed CSP header — identical for every response, no need to rebuild per request
const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://res.cloudinary.com https://*.pusher.com wss://*.pusher.com https://*.neon.tech; frame-src https://www.youtube.com https://youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";

export function middleware(request: NextRequest) {
  // ── Step 1: Security headers for ALL responses ──
  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', CSP_HEADER);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // ── Step 2: Rate limiting + CSRF only for mutation API endpoints ──
  const method = request.method.toUpperCase();
  const isApiMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && request.nextUrl.pathname.startsWith('/api/');

  if (isApiMutation) {
    // CSRF Protection: Validate Origin header
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json(
            { error: 'Forbidden — invalid origin' },
            { status: 403 }
          );
        }
      } catch {
        // Malformed origin — reject
        return NextResponse.json(
          { error: 'Forbidden — malformed origin' },
          { status: 403 }
        );
      }
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
  }

  return response;
}

export const config = {
  // Apply to all routes (for security headers), but skip static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml|logo1\.webp|og-banner\.).*)',
  ],
};
