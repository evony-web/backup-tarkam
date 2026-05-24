// ═══════════════════════════════════════════════════════════
// IDM LEAGUE — ZOD VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════
// Centralized input validation for all API mutation routes.
// Prevents injection, oversized inputs, and malformed data.
// ═══════════════════════════════════════════════════════════

import { z } from 'zod';
import { stripHtml } from './sanitize';

// ═══ Common validators ═══

const nonEmptyString = z.string().trim().min(1);
const safeString = z.string().trim().max(500); // Generic safe string with max length
const safeLongString = z.string().trim().max(5000); // For descriptions etc.

// ═══ Auth schemas ═══

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
});

export const resetPasswordSchema = z.object({
  adminId: z.string().min(1).max(100),
  newPassword: z.string().min(6).max(200),
});

// ═══ Admin CRUD schemas ═══

export const createAdminSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(200),
  role: z.enum(['super_admin', 'admin']).default('admin'),
});

export const updateAdminSchema = z.object({
  id: z.string().min(1).max(100),
  username: z.string().trim().min(3).max(50).optional(),
  role: z.enum(['super_admin', 'admin']).optional(),
});

export const deleteAdminSchema = z.object({
  id: z.string().min(1).max(100),
});

// ═══ Tournament schemas ═══

export const createTournamentSchema = z.object({
  name: safeString.min(1),
  weekNumber: z.number().int().min(1).max(52),
  division: z.enum(['male', 'female']),
  seasonId: z.string().min(1).max(100),
  format: z.enum(['single_elimination', 'group_stage', 'swiss', 'upper_semi']).default('single_elimination'),
  defaultMatchFormat: z.enum(['BO1', 'BO3', 'BO5']).default('BO1'),
  prizePool: z.number().int().min(0).default(0),
  bpm: z.string().trim().max(50).optional(),
  location: z.string().trim().max(200).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// ═══ Registration schemas ═══

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(20),
  city: z.string().trim().min(1).max(100),
  division: z.enum(['male', 'female']),
  clubProfileId: z.string().max(100).nullable().optional(),
  clubId: z.string().max(100).nullable().optional(),
  joki: z.string().trim().max(100).nullable().optional(),
  force: z.boolean().optional(),
  reRegister: z.boolean().optional(),
  reRegisterPlayerId: z.string().max(100).optional(),
  isApprovedPlayer: z.boolean().optional(),
  // Unified registration: optional password for auto account creation
  password: z.string().min(6).max(200).optional(),
});

export const duplicateCheckSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  division: z.enum(['male', 'female']).optional(),
});

// ═══ Player schemas ═══

export const updatePlayerSchema = z.object({
  gamertag: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  division: z.enum(['male', 'female']).optional(),
  tier: z.enum(['S', 'A', 'B']).optional(),
  avatar: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
  registrationStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
});

// ═══ Score schemas ═══

export const updateScoreSchema = z.object({
  score1: z.number().int().min(0).max(99),
  score2: z.number().int().min(0).max(99),
  mvpPlayerId: z.string().max(100).optional(),
});

// ═══ Season schemas ═══

export const createSeasonSchema = z.object({
  name: safeString.min(1),
  number: z.number().int().min(1).max(100),
  division: z.enum(['male', 'female']),
  startDate: z.string().datetime(),
});

// ═══ Club schemas ═══

export const createClubProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  logo: z.string().trim().max(500).optional(),
});

// ═══ Donation schemas ═══

export const createDonationSchema = z.object({
  donorName: z.string().trim().min(1).max(100),
  amount: z.number().int().min(1).max(1000000000),
  message: z.string().trim().max(500).optional(),
  type: z.enum(['weekly', 'monthly', 'special']).default('weekly'),
  division: z.enum(['male', 'female']).default('male'),
  tournamentId: z.string().max(100).optional(),
  seasonId: z.string().max(100).optional(),
});

// ═══ Account registration schema ═══

export const accountRegisterSchema = z.object({
  gamertag: z.string().trim().min(1).max(50),
  password: z.string().min(6).max(200),
  email: z.string().email().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
});

// ═══ Helper ═══

/**
 * Safely validate input with Zod schema.
 * Returns { success: true, data } or { success: false, error: string }.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): 
  | { success: true; data: T }
  | { success: false; error: string } {
  // ── Pre-sanitize: Strip HTML tags from all string fields ──
  const sanitizedInput = typeof input === 'object' && input !== null
    ? sanitizeStrings(input as Record<string, unknown>)
    : input;

  const result = schema.safeParse(sanitizedInput);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Format Zod errors into readable Indonesian messages
  const firstError = result.error.issues[0];
  const field = firstError?.path.join('.') || 'input';
  const message = firstError?.message || 'Format tidak valid';
  return { success: false, error: `${field}: ${message}` };
}

/**
 * Recursively strip HTML tags from all string fields in an object.
 */
function sanitizeStrings(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = stripHtml(value).trim();
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? stripHtml(item).trim() :
        typeof item === 'object' && item !== null ? sanitizeStrings(item as Record<string, unknown>) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeStrings(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
