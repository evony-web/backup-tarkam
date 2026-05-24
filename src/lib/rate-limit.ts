// ============================================
// IDM LEAGUE - IN-MEMORY RATE LIMITING
// ============================================
// Simple rate limiter using in-memory Map.
// Suitable for single-instance deployment (IDM League scale: 20-30 players).

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  maxRequests: number;
  /** Key prefix for grouping */
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within rate limit.
 * Uses IP address or custom key as identifier.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const fullKey = `${options.prefix || 'rl'}:${key}`;
  const now = Date.now();

  const entry = store.get(fullKey);

  // No entry or expired window — start fresh
  if (!entry || now > entry.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(fullKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt,
    };
  }

  // Within window — increment count
  if (entry.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: options.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Extract client IP from request headers (behind Caddy proxy)
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

// Pre-configured rate limiters for common use cases
export const RATE_LIMITS = {
  /** Admin login: 5 attempts per 15 minutes */
  ADMIN_LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 5, prefix: 'admin-login' },
  /** Player login: 10 attempts per 15 minutes */
  PLAYER_LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 10, prefix: 'player-login' },
  /** Player register: 5 attempts per hour */
  PLAYER_REGISTER: { windowMs: 60 * 60 * 1000, maxRequests: 5, prefix: 'player-register' },
  /** Admin API mutations: 60 per minute (generous for admin) */
  ADMIN_MUTATION: { windowMs: 60 * 1000, maxRequests: 60, prefix: 'admin-mut' },
  /** Score submission: 30 per minute (during tournament) */
  SCORE_SUBMIT: { windowMs: 60 * 1000, maxRequests: 30, prefix: 'score' },
  /** General API: 100 per minute */
  GENERAL: { windowMs: 60 * 1000, maxRequests: 100, prefix: 'general' },
  /** Password change: 5 per 15 minutes */
  PASSWORD_CHANGE: { windowMs: 15 * 60 * 1000, maxRequests: 5, prefix: 'pw-change' },
} as const;

/**
 * Helper to create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
