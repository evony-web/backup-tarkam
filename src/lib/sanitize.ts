// ============================================
// IDM LEAGUE - INPUT SANITIZATION
// ============================================
// Prevents XSS by stripping HTML tags and encoding
// dangerous characters from user input.

/**
 * Strip all HTML tags from a string.
 * Uses a safe regex approach that handles common XSS vectors.
 */
export function stripHtml(input: string): string {
  // Remove HTML tags
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe display (XSS prevention).
 * - Strips HTML tags
 * - Encodes dangerous characters (<, >, &, ", ')
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return input;
  return stripHtml(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a string for storage (strip HTML but don't encode).
 * Use this when saving to database — the display layer handles encoding.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and trim whitespace
  return stripHtml(input).trim();
}

/**
 * Sanitize an object's string fields recursively.
 * Only sanitizes own enumerable string properties.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeInput(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
