// ============================================
// IDM LEAGUE - SKIN UTILITY FUNCTIONS
// Handles skin type constants, color parsing, priority logic, and expiration
// ============================================

/**
 * Skin color configuration — stored as JSON in the Skin.colorClass database field.
 * All color values are actual CSS color strings (not Tailwind class names) because
 * Tailwind JIT cannot scan dynamic class names from the database at build time.
 *
 * - frame: ring color (CSS color string for ring-* utility)
 * - name: gradient colors for player name (CSS color string, pipe-separated for gradient stops)
 * - badge: background + text colors (CSS color strings, pipe-separated: "bg|text")
 * - border: gradient colors for card border (CSS color string, pipe-separated for gradient stops)
 * - glow: shadow/glow color (CSS rgba string)
 */
export interface SkinColors {
  frame: string;   // e.g. "#facc15" (yellow-400)
  name: string;    // e.g. "#fde047|#f59e0b|#eab308" (gradient stops)
  badge: string;   // e.g. "rgba(234,179,8,0.2)|#fde047" (bg|text)
  border: string;  // e.g. "#eab308|#f59e0b|#fde047" (gradient stops)
  glow: string;    // e.g. "rgba(234,179,8,0.4)"
}

/**
 * Full skin details including metadata, used in rendering components.
 */
export interface PlayerSkinWithDetails {
  type: string;
  icon: string;
  displayName: string;
  colorClass: string;       // JSON string from database — parse with parseSkinColors()
  priority: number;
  duration: string;         // "weekly" | "permanent"
  reason?: string | null;
  expiresAt?: string | null;
  /** Permanent donor heart badge count (independent of skin expiry) */
  donorBadgeCount?: number;
}

// ============================================
// SKIN TYPE DEFINITIONS
// Each skin has an icon, display name, priority, duration, and color scheme
// ============================================

export const SKIN_TYPES = {
  champion: {
    type: 'champion',
    icon: '🥇',
    displayName: 'Gold Crown',
    priority: 4,
    duration: 'weekly',
    twinkle: '✦',
  },
  champion_1: {
    type: 'champion_1',
    icon: '👑',
    displayName: 'Royal Gold Crown',
    priority: 5,
    duration: 'weekly',
    twinkle: '✦',
  },
  champion_2: {
    type: 'champion_2',
    icon: '👑',
    displayName: 'Royal Gold Crown',
    priority: 4,
    duration: 'weekly',
    twinkle: '✦',
  },
  champion_3: {
    type: 'champion_3',
    icon: '👑',
    displayName: 'Royal Gold Crown',
    priority: 3,
    duration: 'weekly',
    twinkle: '✦',
  },
  season_champion: {
    type: 'season_champion',
    icon: '💎',
    displayName: 'Season Champion',
    priority: 7,
    duration: 'season',
    twinkle: '💎',
  },
  mvp: {
    type: 'mvp',
    icon: '⭐',
    displayName: 'Platinum Star',
    priority: 3,
    duration: 'weekly',
    twinkle: '✦',
  },
  sawer_bronze: {
    type: 'sawer_bronze',
    icon: '💵',
    displayName: 'Emerald Sawer',
    priority: 2,
    duration: 'weekly',
    twinkle: '$',
  },
  sawer_silver: {
    type: 'sawer_silver',
    icon: '💵',
    displayName: 'Emerald Sawer+',
    priority: 3,
    duration: 'weekly',
    twinkle: '$',
  },
  sawer_gold: {
    type: 'sawer_gold',
    icon: '💵',
    displayName: 'Emerald Sawer++',
    priority: 4,
    duration: 'weekly',
    twinkle: '$',
  },
  sawer_diamond: {
    type: 'sawer_diamond',
    icon: '💵',
    displayName: 'Emerald Sawer Elite',
    priority: 5,
    duration: 'weekly',
    twinkle: '$',
  },
  donor: {
    type: 'donor',
    icon: '❤️',
    displayName: 'Maroon Heart',
    priority: 6,
    duration: 'weekly',
    twinkle: '♥',
  },
  sultan: {
    type: 'sultan',
    icon: '👑',
    displayName: 'Sultan of Season',
    priority: 8,
    duration: 'season',
    twinkle: '💵',
  },
  sultan_weekly: {
    type: 'sultan_weekly',
    icon: '❤️',
    displayName: 'Sultan of the Week',
    priority: 5,
    duration: 'weekly',
    twinkle: '♥',
  },
} as const;

export type SkinTypeKey = keyof typeof SKIN_TYPES;

// ============================================
// DEFAULT COLOR SCHEMES PER SKIN TYPE
// These are the "built-in" colors when the DB colorClass is not set or fails to parse.
// All values are CSS color strings (NOT Tailwind class names) for inline style usage.
// ============================================

export const DEFAULT_SKIN_COLORS: Record<string, SkinColors> = {
  // ═══ CHAMPION — Royal Gold (semua juara satu kesatuan) ═══
  champion: {
    frame: '#ffd700',                                            // pure gold
    name: '#fff8dc|#ffd700|#daa520',                             // cornsilk → gold → goldenrod (royal gold gradient)
    badge: 'rgba(255,215,0,0.2)|#fff8dc',                        // gold/20 bg | cornsilk text
    border: '#daa520|#ffd700|#fff8dc|#ffd700|#daa520',           // goldenrod → gold → cornsilk → gold → goldenrod (shimmer)
    glow: 'rgba(255,215,0,0.5)',
  },
  champion_1: {
    frame: '#ffd700',                                            // pure gold — sama dengan champion
    name: '#fff8dc|#ffd700|#daa520',                             // cornsilk → gold → goldenrod
    badge: 'rgba(255,215,0,0.2)|#fff8dc',
    border: '#daa520|#ffd700|#fff8dc|#ffd700|#daa520',
    glow: 'rgba(255,215,0,0.5)',
  },
  champion_2: {
    frame: '#ffd700',                                            // pure gold — sama dengan champion
    name: '#fff8dc|#ffd700|#daa520',                             // cornsilk → gold → goldenrod
    badge: 'rgba(255,215,0,0.2)|#fff8dc',
    border: '#daa520|#ffd700|#fff8dc|#ffd700|#daa520',
    glow: 'rgba(255,215,0,0.5)',
  },
  champion_3: {
    frame: '#ffd700',                                            // pure gold — sama dengan champion
    name: '#fff8dc|#ffd700|#daa520',                             // cornsilk → gold → goldenrod
    badge: 'rgba(255,215,0,0.2)|#fff8dc',
    border: '#daa520|#ffd700|#fff8dc|#ffd700|#daa520',
    glow: 'rgba(255,215,0,0.5)',
  },
  // ═══ SEASON CHAMPION — Diamond Blue (paling langka, 1 tim per season) ═══
  season_champion: {
    frame: '#4FC3F7',                                            // diamond blue
    name: '#E0F7FA|#4FC3F7|#0288D1',                             // ice-white → diamond-blue → deep-blue (diamond shimmer)
    badge: 'rgba(79,195,247,0.2)|#E0F7FA',                       // diamond/20 bg | ice-white text
    border: '#0288D1|#4FC3F7|#E0F7FA|#4FC3F7|#0288D1',           // deep → diamond → ice → diamond → deep
    glow: 'rgba(79,195,247,0.5)',
  },
  // ═══ MVP — Platinum ═══
  mvp: {
    frame: '#E5E4E2',                                            // platinum
    name: '#F5F5F5|#E5E4E2|#B0B0B0',                             // white-platinum → platinum → dark-platinum (star shine)
    badge: 'rgba(229,228,226,0.2)|#F5F5F5',                      // platinum/20 bg | white-platinum text
    border: '#B0B0B0|#E5E4E2|#F5F5F5|#E5E4E2|#B0B0B0',           // dark → platinum → white → platinum → dark
    glow: 'rgba(229,228,226,0.5)',
  },
  // ═══ SAWER — Emerald Green (uang/money vibe) ═══
  sawer_bronze: {
    frame: '#2E7D32',                                            // emerald dark (bronze tier)
    name: '#A5D6A7|#2E7D32|#1B5E20',                             // light-emerald → emerald → dark-emerald
    badge: 'rgba(46,125,50,0.2)|#A5D6A7',                        // emerald/20 bg | light-emerald text
    border: '#1B5E20|#2E7D32|#A5D6A7',                           // dark → emerald → light
    glow: 'rgba(46,125,50,0.45)',
  },
  sawer_silver: {
    frame: '#43A047',                                            // emerald medium (silver tier)
    name: '#A5D6A7|#43A047|#2E7D32',                             // light-emerald → emerald-med → emerald-dark
    badge: 'rgba(67,160,71,0.2)|#A5D6A7',                        // emerald-med/20 bg | light-emerald text
    border: '#2E7D32|#43A047|#A5D6A7|#43A047|#2E7D32',
    glow: 'rgba(67,160,71,0.45)',
  },
  sawer_gold: {
    frame: '#66BB6A',                                            // emerald bright (gold tier)
    name: '#C8E6C9|#66BB6A|#43A047',                             // pale-emerald → bright-emerald → medium-emerald
    badge: 'rgba(102,187,106,0.2)|#C8E6C9',                      // bright-emerald/20 bg | pale-emerald text
    border: '#43A047|#66BB6A|#C8E6C9|#66BB6A|#43A047',
    glow: 'rgba(102,187,106,0.5)',
  },
  sawer_diamond: {
    frame: '#00E676',                                            // emerald neon (diamond tier — paling terang)
    name: '#B9F6CA|#00E676|#00C853',                             // ice-emerald → neon-emerald → vivid-emerald
    badge: 'rgba(0,230,118,0.2)|#B9F6CA',                        // neon-emerald/20 bg | ice-emerald text
    border: '#00C853|#00E676|#B9F6CA|#00E676|#00C853',
    glow: 'rgba(0,230,118,0.5)',
  },
  // ═══ DONOR — Maroon (kebaikan/hati) ═══
  donor: {
    frame: '#800020',                                            // maroon classic
    name: '#C4A3A5|#800020|#5C0015',                             // rose-dust → maroon → dark-maroon
    badge: 'rgba(128,0,32,0.2)|#C4A3A5',                         // maroon/20 bg | rose-dust text
    border: '#5C0015|#800020|#C4A3A5|#800020|#5C0015',           // dark → maroon → rose → maroon → dark
    glow: 'rgba(128,0,32,0.5)',
  },
  // ═══ SULTAN — Emerald Royal (top penyawer per season, lebih tinggi dari season_champion) ═══
  sultan: {
    frame: '#43A047',                                            // emerald classic
    name: '#C8E6C9|#43A047|#1B5E20',                             // pale-emerald → emerald → dark-emerald (royal emerald)
    badge: 'rgba(67,160,71,0.2)|#C8E6C9',                        // emerald/20 bg | pale-emerald text
    border: '#1B5E20|#43A047|#C8E6C9|#66BB6A|#43A047|#1B5E20',  // dark → emerald → pale → bright → emerald → dark (royal shimmer)
    glow: 'rgba(67,160,71,0.55)',
  },
  // ═══ SULTAN WEEKLY — Maroon Heart (top penyawer per tournament/week, same as donasi skin) ═══
  sultan_weekly: {
    frame: '#800020',                                            // maroon classic (same as donor)
    name: '#C4A3A5|#800020|#5C0015',                             // rose-dust → maroon → dark-maroon (same as donor)
    badge: 'rgba(128,0,32,0.2)|#C4A3A5',                         // maroon/20 bg | rose-dust text
    border: '#5C0015|#800020|#C4A3A5|#800020|#5C0015',           // dark → maroon → rose → maroon → dark
    glow: 'rgba(128,0,32,0.5)',
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Safely parse the colorClass JSON string from the database.
 * Returns null if the string is invalid or cannot be parsed.
 * Falls back to DEFAULT_SKIN_COLORS if the parsed object is missing required keys.
 */
export function parseSkinColors(colorClass: string): SkinColors | null {
  if (!colorClass) return null;
  try {
    const parsed = JSON.parse(colorClass);
    // Validate required keys exist
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'frame' in parsed &&
      'name' in parsed &&
      'badge' in parsed &&
      'border' in parsed &&
      'glow' in parsed
    ) {
      return parsed as SkinColors;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the resolved SkinColors for a skin, trying the colorClass JSON first,
 * then falling back to DEFAULT_SKIN_COLORS by type.
 */
export function resolveSkinColors(skin: { type: string; colorClass: string }): SkinColors | null {
  const parsed = parseSkinColors(skin.colorClass);
  if (parsed) return parsed;
  return DEFAULT_SKIN_COLORS[skin.type] ?? null;
}

/**
 * Parse a pipe-separated color string into an array of CSS color strings.
 * Used for gradient stops in name, border, and badge rendering.
 */
export function parseColorStops(colorStr: string): string[] {
  return colorStr.split('|').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse the badge color string into background and text colors.
 * Format: "bgColor|textColor"
 */
export function parseBadgeColors(badgeStr: string): { bg: string; text: string } {
  const parts = badgeStr.split('|');
  return {
    bg: parts[0]?.trim() ?? 'rgba(255,255,255,0.1)',
    text: parts[1]?.trim() ?? '#ffffff',
  };
}

/**
 * Build a CSS linear-gradient string from pipe-separated color stops.
 */
export function buildGradient(colorStops: string, direction: string = '135deg'): string {
  const stops = parseColorStops(colorStops);
  if (stops.length === 0) return 'transparent';
  if (stops.length === 1) return stops[0];
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

/**
 * Get the primary (highest priority) skin from a list.
 * Returns null if the list is empty.
 */
export function getPrimarySkin(skins: PlayerSkinWithDetails[]): PlayerSkinWithDetails | null {
  if (!skins || skins.length === 0) return null;
  const sorted = sortSkinsByPriority(skins);
  return sorted[0] ?? null;
}

/**
 * Sort skins by priority (highest first).
 * Ties are broken alphabetically by displayName for stable ordering.
 */
export function sortSkinsByPriority(skins: PlayerSkinWithDetails[]): PlayerSkinWithDetails[] {
  if (!skins) return [];
  return [...skins].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Check if a skin has expired.
 * Returns true if expiresAt is in the past.
 * Returns false if expiresAt is null/undefined (permanent skin) or still in the future.
 */
export function isSkinExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  try {
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) return false;
    return expiryDate.getTime() < Date.now();
  } catch {
    return false;
  }
}

/**
 * Filter out expired skins from a list.
 */
export function filterActiveSkins(skins: PlayerSkinWithDetails[]): PlayerSkinWithDetails[] {
  return skins.filter(skin => !isSkinExpired(skin.expiresAt));
}

/**
 * Get the SKIN_TYPES entry for a given type string.
 */
export function getSkinTypeDefinition(type: string): (typeof SKIN_TYPES)[SkinTypeKey] | undefined {
  return SKIN_TYPES[type as SkinTypeKey];
}

/**
 * Check if a skin type is a sawer (donation) tier skin.
 * Used to hide redundant sawer badges when Sultan of the Week badge is present.
 */
export function isSawerType(type: string): boolean {
  return type.startsWith('sawer_') || type === 'sawer_badge';
}

/**
 * Get the twinkle symbol for a skin type.
 * Falls back to ✦ if the skin type is not found.
 */
export function getSkinTwinkle(type: string): string {
  const def = SKIN_TYPES[type as SkinTypeKey];
  return def?.twinkle ?? '✦';
}

// ============================================
// DONOR BADGE HELPERS
// Heart badges persist permanently even after donor skin expires
// 1-4 donations: small heart badge
// 5+ donations: bigger heart badge with pulse glow
// ============================================

/**
 * Get the donor badge display config based on donation count.
 * Returns null if count is 0 (no badge to show).
 */
export function getDonorBadgeConfig(donorBadgeCount: number): {
  size: 'sm' | 'lg';
  hasPulseGlow: boolean;
  label: string;
} | null {
  if (donorBadgeCount <= 0) return null;

  if (donorBadgeCount >= 5) {
    return {
      size: 'lg',
      hasPulseGlow: true,
      label: `❤️×${donorBadgeCount}`,
    };
  }

  return {
    size: 'sm',
    hasPulseGlow: false,
    label: donorBadgeCount === 1 ? '❤️' : `❤️×${donorBadgeCount}`,
  };
}

/**
 * Check if a donor badge should be shown for a player.
 * This is independent of whether the donor skin is active or expired.
 */
export function shouldShowDonorBadge(donorBadgeCount: number): boolean {
  return donorBadgeCount > 0;
}

// ============================================
// SAWER TIER HELPERS
// Tiered sawer skin system: Bronze, Silver, Gold, Diamond
// Based on weekly sawer (donation) amount
// ============================================

/**
 * Sawer tier definitions, ordered from highest to lowest.
 */
export const SAWER_TIERS = [
  { type: 'sawer_diamond', label: 'Emerald Elite', icon: '💵', minAmount: 200000, color: 'text-emerald-400' },
  { type: 'sawer_gold', label: 'Emerald++', icon: '💵', minAmount: 100000, color: 'text-emerald-500' },
  { type: 'sawer_silver', label: 'Emerald+', icon: '💵', minAmount: 50000, color: 'text-emerald-600' },
  { type: 'sawer_bronze', label: 'Emerald', icon: '💵', minAmount: 10000, color: 'text-emerald-700' },
] as const;

/**
 * Determine the sawer tier skin type based on total weekly sawer amount.
 * Returns the skin type string (e.g. 'sawer_diamond') or null if below threshold.
 */
export function getSawerTier(amount: number): string | null {
  if (amount >= 200000) return 'sawer_diamond';
  if (amount >= 100000) return 'sawer_gold';
  if (amount >= 50000) return 'sawer_silver';
  if (amount >= 10000) return 'sawer_bronze';
  return null;
}

/**
 * Get the sawer badge display config for a permanent tier badge.
 * Returns null if the tier is invalid.
 */
export function getSawerBadgeConfig(tier: string): {
  icon: string;
  size: 'sm' | 'md' | 'lg';
  hasGlow: boolean;
  label: string;
} | null {
  switch (tier) {
    case 'sawer_diamond':
    case 'diamond':
      return { icon: '💵', size: 'lg', hasGlow: true, label: 'Emerald Elite Sawer' };
    case 'sawer_gold':
    case 'gold':
      return { icon: '💵', size: 'md', hasGlow: false, label: 'Emerald++ Sawer' };
    case 'sawer_silver':
    case 'silver':
      return { icon: '💵', size: 'sm', hasGlow: false, label: 'Emerald+ Sawer' };
    case 'sawer_bronze':
    case 'bronze':
      return { icon: '💵', size: 'sm', hasGlow: false, label: 'Emerald Sawer' };
    default:
      return null;
  }
}
