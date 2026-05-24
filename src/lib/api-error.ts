/**
 * Safely handle API errors — never leak internal details to clients.
 * In development, show the real error for debugging.
 * In production, return a generic message.
 */
export function getSafeErrorMessage(error: unknown, fallback = 'Terjadi kesalahan server'): string {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : fallback;
  }
  return fallback;
}

/**
 * Create a standardized error response
 */
export function errorResponse(message: string, status: number = 500, details?: Record<string, string>) {
  return Response.json(
    { error: message, ...(details || {}) },
    { status }
  );
}
