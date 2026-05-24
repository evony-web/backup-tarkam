// ─── DB Resilience Helpers ───
// Utilities for gracefully handling database errors in API routes.
// Supports PostgreSQL (Neon) — handles connection errors, timeouts, and transient issues.

import { NextResponse } from 'next/server';

/**
 * Check if an error is a database configuration error
 * (e.g., invalid DATABASE_URL, Prisma can't connect)
 */
export function isDbConfigError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || '';
    return (
      msg.includes('Database not configured') ||
      msg.includes('DATABASE_URL') ||
      msg.includes('P1001') || // Can't reach database server
      msg.includes('P1003') || // Database does not exist
      error.constructor?.name === 'PrismaClientInitializationError'
    );
  }
  return false;
}

/**
 * Return a 503 Service Unavailable response for DB config errors,
 * or re-throw non-DB errors so they can be handled by the caller.
 */
export function handleDbError(error: unknown): NextResponse | never {
  if (isDbConfigError(error)) {
    return NextResponse.json(
      {
        error: 'Database sedang tidak tersedia',
        hint: 'DATABASE_URL belum dikonfigurasi. Hubungi admin.',
      },
      { status: 503 }
    );
  }
  throw error; // Re-throw non-DB errors
}

/**
 * Check if an error is retryable based on the current database provider.
 * PostgreSQL (Neon): connection timeout, pool timeout, transient connection errors
 */
function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);

  // PostgreSQL / Neon retryable errors (Prisma error codes)
  const retryableCodes = [
    'P1001', // Can't reach database server
    'P1002', // Database server rejected the connection
    'P1008', // Operations timed out
    'P5012', // Connection pool timeout
    'P5014', // Prisma client could not get a connection from the pool
    'P5016', // Connection pool is exhausted
    'P5017', // Connection pool is closed
  ];

  if (retryableCodes.some(code => msg.includes(code))) return true;

  // Common retryable patterns
  const retryablePatterns = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'connection timeout',
    'connection refused',
    'too many connections',
    'pool exhausted',
  ];

  return retryablePatterns.some(pattern =>
    msg.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Retry wrapper for database operations.
 * Handles PostgreSQL connection errors and transient issues.
 * Also handles DB config errors gracefully (returns 503 instead of crashing).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If it's a DB config error, don't retry — it won't fix itself
      if (isDbConfigError(error)) {
        throw error;
      }

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms...
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[db-resilience] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * @deprecated Use withDbRetry instead. Kept for backward compatibility.
 */
export const withNeonRetry = withDbRetry;
