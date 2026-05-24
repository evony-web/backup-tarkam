/**
 * Shared constants for the IDM League platform.
 * All hardcoded values that are used in multiple places should live here.
 */

// ── Season Configuration ──
/** Maximum number of tournament weeks per season */
export const SEASON_TOTAL_WEEKS = 10;

// ── Division Constants ──
export const DIVISION = {
  MALE: 'male',
  FEMALE: 'female',
} as const;

export type Division = (typeof DIVISION)[keyof typeof DIVISION];

// ── Division Accent Colors ──
// Aligned with CSS vars --idm-male / --idm-female and use-division-theme.ts
export const DIVISION_COLORS = {
  male: {
    accent: '#2E9FFF',       // Electric Cyan-Blue — modern gaming vibe
    accentLight: '#57B5FF',  // Bright Electric Blue — idm-male CSS var
    accentFaint: '#8FCEFF',  // Light Cyber Blue — idm-male-light CSS var
    accentDark: '#1478D9',   // Deep Electric Blue — darker variant
  },
  female: {
    accent: '#FF2D78',       // Vivid Hot Pink — trendy & energetic
    accentLight: '#FF5C9A',  // Bright Hot Pink — idm-female CSS var
    accentFaint: '#FF8FBC',  // Light Rose Pink — idm-female-light CSS var
    accentDark: '#D9165E',   // Deep Hot Pink — darker variant
  },
} as const;

// ── Gold / Brand Colors ──
export const GOLD = {
  warm: '#EFF923',
  light: '#F9CB25',
  dim: '#B7791F',
} as const;

// ── Tier Order ──
export const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

// ── Tournament Status ──
export const TOURNAMENT_STATUS = {
  DRAFT: 'draft',
  REGISTRATION: 'registration',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// ── Season Status ──
export const SEASON_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  UPCOMING: 'upcoming',
} as const;
