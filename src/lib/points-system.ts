/**
 * IDM League - Unified Points System
 * 
 * This module contains all point calculation logic to ensure consistency
 * between frontend display and backend calculations.
 * 
 * === POINTS FORMULA ===
 * Point Sources (only 3):
 * - Win Match: +1 pt per win
 * - Streak Bonus: +2 pts for every 3 consecutive wins (applies to ALL formats)
 * - Prize Juara: points from TournamentPrize (juara 1/2/3)
 * 
 * NO points for: participation, MVP (per match), achievements, draws
 * 
 * Streak calculation:
 * - Every 3 consecutive wins = +2 pts bonus
 * - Streak of 3 = +2 pts, streak of 6 = +4 pts, streak of 9 = +6 pts, etc.
 * - Loss resets streak to 0
 * - Applies to ALL bracket formats (single_elimination, swiss, group_stage, etc.)
 */

export interface PointsBreakdown {
  matchWins: number;           // 1 pt per win
  streakBonus: number;         // +2 pts per 3 consecutive wins
  prizePoints: number;         // Points from TournamentPrize (juara 1/2/3)
  total: number;
}

export interface PlayerStats {
  matches: number;
  totalWins: number;
  totalMvp: number;
  streak: number;
  tier: string;
  format?: string; // Tournament format (streak bonus applies to ALL formats now)
}

/**
 * Calculate streak bonus points
 * Every 3 consecutive wins = +2 pts bonus
 * e.g. streak of 3 = +2, streak of 6 = +4, streak of 9 = +6
 * 
 * Applies to ALL bracket formats (including single_elimination and swiss)
 */
export function calculateStreakBonus(streak: number, _format?: string): number {
  // Streak bonus applies to ALL formats now
  return Math.floor(streak / 3) * 2;
}

/**
 * Get tier multiplier — DISABLED, always returns 1.0
 */
export function getTierMultiplier(_tier: string): number {
  return 1.0; // Tier multiplier disabled
}

/**
 * Calculate full points breakdown for a player
 * Only 3 point sources: match wins, streak bonus, prize juara
 */
export function calculatePointsBreakdown(stats: PlayerStats): PointsBreakdown {
  const matchWins = stats.totalWins * 1;                         // 1 pt per win
  const streakBonus = calculateStreakBonus(stats.streak, stats.format); // +2 per 3-streak
  
  // Note: prizePoints are awarded separately at tournament finalization
  // and tracked via PlayerPoint records. They are not calculated from stats.
  const prizePoints = 0; // Must be fetched from PlayerPoint audit trail
  
  const total = matchWins + streakBonus + prizePoints;
  
  return {
    matchWins,
    streakBonus,
    prizePoints,
    total,
  };
}

/**
 * Recalculate total points for a player from scratch
 * Use this to ensure consistency after data changes
 * NOTE: This only calculates match wins + streak bonus.
 * Prize points must be added from PlayerPoint audit trail.
 */
export function recalculateTotalPoints(stats: PlayerStats): number {
  return calculatePointsBreakdown(stats).total;
}

/**
 * Points earned for winning a match
 * Win: +1 pt (same for ALL formats including Swiss)
 */
export function getWinPoints(_tier: string, _format?: string): number {
  return 1; // +1 pt for winning, regardless of format
}

/**
 * Points earned for losing a match
 * Loss: 0 pts
 */
export function getLossPoints(_tier: string): number {
  return 0; // 0 pts for losing
}

/**
 * Points earned for MVP per match — DISABLED
 * MVP is now awarded only at tournament finalization (per week)
 */
export function getMvpPoints(): number {
  return 0; // No per-match MVP points
}

/**
 * Calculate new streak after a match result
 */
export function calculateNewStreak(currentStreak: number, won: boolean): number {
  if (won) {
    return currentStreak + 1;
  }
  return 0; // Loss resets streak
}

/**
 * Season phases
 */
export const SEASON_PHASES = {
  REGISTRATION: 'registration',   // Week 1-2: Team formation, player registration
  COMPETITION: 'competition',     // Week 3-10: Weekly tournaments, league matches
  PLAYOFFS: 'playoffs',          // Week 11-12: Final brackets, championship
} as const;

export type SeasonPhase = typeof SEASON_PHASES[keyof typeof SEASON_PHASES];

/**
 * Determine current season phase based on week
 */
export function getSeasonPhase(currentWeek: number, totalWeeks: number): SeasonPhase {
  if (currentWeek <= 2) return SEASON_PHASES.REGISTRATION;
  if (currentWeek <= totalWeeks - 2) return SEASON_PHASES.COMPETITION;
  return SEASON_PHASES.PLAYOFFS;
}
