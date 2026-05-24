// ============================================
// IDM LEAGUE - POINTS & RANKING SYSTEM
// ============================================

import { db } from '@/lib/db';

// ===== TIER SYSTEM =====
// Tier is managed manually by admin — no automatic upgrade based on points.
// Admin assigns tier when approving player participation in tournaments.
// The tier can also be overridden per-tournament via Participation.tierOverride.

export const TIER_ORDER = { S: 3, A: 2, B: 1 } as const;

export type Tier = 'S' | 'A' | 'B';

/**
 * Award points to a player with full audit trail via PlayerPoint record.
 * Also updates the player's total (lifetime) points.
 */
export async function awardPoints(params: {
  playerId: string;
  amount: number;
  reason: string;
  description: string;
  tournamentId?: string;
  matchId?: string;
  seasonId?: string;
}) {
  const { playerId, amount, reason, description, tournamentId, matchId, seasonId } = params;

  // Create audit record
  await db.playerPoint.create({
    data: {
      playerId,
      amount,
      reason,
      description,
      tournamentId: tournamentId || null,
      matchId: matchId || null,
      seasonId: seasonId || null,
    },
  });

  // Update player total points (lifetime) — use increment to avoid race conditions
  await db.player.update({
    where: { id: playerId },
    data: { points: { increment: amount } },
  });
}

/**
 * Recalculate all player points from scratch using PlayerPoint audit trail.
 * This is a safety net for data integrity.
 */
export async function recalculateAllPoints(division?: string) {
  const where: Record<string, string> = {};
  if (division) where.division = division;

  const players = await db.player.findMany({ where });

  const results: {
    playerId: string;
    gamertag: string;
    oldPoints: number;
    newPoints: number;
    diff: number;
  }[] = [];

  for (const player of players) {
    const pointRecords = await db.playerPoint.findMany({
      where: { playerId: player.id },
    });

    const calculatedPoints = pointRecords.reduce((sum, r) => sum + r.amount, 0);
    const diff = calculatedPoints - player.points;

    if (diff !== 0) {
      await db.player.update({
        where: { id: player.id },
        data: { points: calculatedPoints },
      });
    }

    results.push({
      playerId: player.id,
      gamertag: player.gamertag,
      oldPoints: player.points,
      newPoints: calculatedPoints,
      diff,
    });
  }

  return results;
}
