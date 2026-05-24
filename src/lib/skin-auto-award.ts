// ============================================
// IDM LEAGUE - SKIN AUTO-AWARD UTILITY
// Automatically awards skins when tournaments are finalized
// - Champion skin: champion_1 — ONLY for Juara 1 (weekly/tarkam winner)
// - Season Champion skin: season_champion — Diamond Blue (paling langka)
// - MVP skin: awarded to the MVP player (1 week duration)
// ============================================

import { db } from '@/lib/db';

interface AutoAwardResult {
  playerId: string;
  gamertag: string;
  skinType: string;
  displayName: string;
  action: 'awarded' | 'extended' | 'skipped_no_account' | 'skipped_already_active';
}

/** Map team rank to skin type — ONLY Juara 1 gets champion skin */
function getChampionSkinType(rank: number): string | null {
  if (rank === 1) return 'champion_1';
  // Juara 2 and 3 do NOT get champion skin — only Juara 1
  return null;
}

/** Map team rank to Indonesian reason text */
function getChampionReasonText(rank: number, tournamentName: string | null): string {
  const prefix = tournamentName || 'Tournament';
  if (rank === 1) return `Juara ${prefix}`;
  if (rank === 2) return `Juara ${prefix}`;
  if (rank === 3) return `Juara ${prefix}`;
  return `Juara ${prefix}`;
}

/**
 * Auto-award skins after tournament finalization.
 * Supports podium-ranked teams (1st/2nd/3rd) with different skin colors.
 *
 * @param tournamentId - The tournament that was just finalized
 * @param teamRankings - Array of { teamId, rank } for podium teams (rank 1, 2, or 3)
 * @param mvpPlayerId - The MVP player ID (optional, may not have one)
 * @param adminId - The admin who finalized (for awardedBy field)
 * @returns Array of results for each player processed
 */
export async function autoAwardTournamentSkins(
  tournamentId: string,
  teamRankings: Array<{ teamId: string; rank: number }>,
  mvpPlayerId: string | null,
  adminId: string
): Promise<AutoAwardResult[]>;

/**
 * Legacy overload: accepts single rank1TeamId (backward compatible)
 */
export async function autoAwardTournamentSkins(
  tournamentId: string,
  rank1TeamId: string | null,
  mvpPlayerId: string | null,
  adminId: string
): Promise<AutoAwardResult[]>;

// Implementation
export async function autoAwardTournamentSkins(
  tournamentId: string,
  teamRankingsOrRank1: Array<{ teamId: string; rank: number }> | string | null,
  mvpPlayerId: string | null,
  adminId: string
): Promise<AutoAwardResult[]> {
  const results: AutoAwardResult[] = [];

  // Normalize input: support both legacy (string|null) and new (array) formats
  let teamRankings: Array<{ teamId: string; rank: number }>;
  if (Array.isArray(teamRankingsOrRank1)) {
    teamRankings = teamRankingsOrRank1;
  } else if (typeof teamRankingsOrRank1 === 'string' && teamRankingsOrRank1) {
    // Legacy: single rank1TeamId → convert to array
    teamRankings = [{ teamId: teamRankingsOrRank1, rank: 1 }];
  } else {
    teamRankings = [];
  }

  // Get tournament info for the reason text
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, weekNumber: true },
  });

  // 1 week from now for expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // ===== AWARD CHAMPION SKIN TO JUARA 1 ONLY =====
  for (const { teamId, rank } of teamRankings) {
    const skinType = getChampionSkinType(rank);
    if (!skinType) continue; // Only rank 1 (Juara 1) gets champion skin

    const reasonPrefix = getChampionReasonText(rank, tournament?.name ?? null);

    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        teamPlayers: {
          include: {
            player: {
              select: {
                id: true,
                gamertag: true,
                account: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!team) continue;

    const championSkin = await db.skin.findUnique({
      where: { type: skinType },
    });

    // Fallback to generic 'champion' skin if rank-specific not found
    const skin = championSkin ?? await db.skin.findUnique({
      where: { type: 'champion' },
    });

    if (!skin) continue;

    for (const tp of team.teamPlayers) {
      const player = tp.player;
      const accountId = player.account?.id;

      if (!accountId) {
        results.push({
          playerId: player.id,
          gamertag: player.gamertag,
          skinType: skin.type,
          displayName: skin.displayName,
          action: 'skipped_no_account',
        });
        continue;
      }

      const result = await awardOrExtendSkin({
        accountId,
        skinId: skin.id,
        skinType: skin.type,
        displayName: skin.displayName,
        gamertag: player.gamertag,
        playerId: player.id,
        reason: reasonPrefix,
        expiresAt,
        awardedBy: adminId,
      });

      results.push(result);
    }
  }

  // ===== AWARD MVP SKIN =====
  if (mvpPlayerId) {
    const mvpSkin = await db.skin.findUnique({
      where: { type: 'mvp' },
    });

    if (mvpSkin) {
      const player = await db.player.findUnique({
        where: { id: mvpPlayerId },
        select: {
          id: true,
          gamertag: true,
          account: { select: { id: true } },
        },
      });

      if (player) {
        const accountId = player.account?.id;

        if (!accountId) {
          results.push({
            playerId: player.id,
            gamertag: player.gamertag,
            skinType: 'mvp',
            displayName: mvpSkin.displayName,
            action: 'skipped_no_account',
          });
        } else {
          const mvpReason = tournament
            ? `MVP ${tournament.name}`
            : 'MVP Tournament';

          const result = await awardOrExtendSkin({
            accountId,
            skinId: mvpSkin.id,
            skinType: 'mvp',
            displayName: mvpSkin.displayName,
            gamertag: player.gamertag,
            playerId: player.id,
            reason: mvpReason,
            expiresAt,
            awardedBy: adminId,
          });

          results.push(result);
        }
      }
    }
  }

  return results;
}

/**
 * Award a new skin or extend the expiry if the player already has an active one.
 * - If no existing record → create new PlayerSkin
 * - If existing but expired → re-award (update expiry, reason)
 * - If existing and still active → extend expiry by 7 days from now
 */
async function awardOrExtendSkin(params: {
  accountId: string;
  skinId: string;
  skinType: string;
  displayName: string;
  gamertag: string;
  playerId: string;
  reason: string;
  expiresAt: Date;
  awardedBy: string;
}): Promise<AutoAwardResult> {
  const { accountId, skinId, skinType, displayName, gamertag, playerId, reason, expiresAt, awardedBy } = params;

  const existing = await db.playerSkin.findUnique({
    where: { accountId_skinId: { accountId, skinId } },
  });

  if (!existing) {
    // No record — create new
    await db.playerSkin.create({
      data: {
        accountId,
        skinId,
        awardedBy,
        reason,
        expiresAt,
      },
    });

    return {
      playerId,
      gamertag,
      skinType,
      displayName,
      action: 'awarded',
    };
  }

  const isExpired = existing.expiresAt && new Date(existing.expiresAt) < new Date();

  if (isExpired) {
    // Expired — re-award
    await db.playerSkin.update({
      where: { id: existing.id },
      data: {
        awardedBy,
        reason,
        expiresAt,
        createdAt: new Date(),
      },
    });

    return {
      playerId,
      gamertag,
      skinType,
      displayName,
      action: 'awarded',
    };
  }

  // Still active — extend expiry by 7 days from now
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  await db.playerSkin.update({
    where: { id: existing.id },
    data: {
      expiresAt: newExpiry,
      reason, // Update reason to latest win
      awardedBy,
    },
  });

  return {
    playerId,
    gamertag,
    skinType,
    displayName,
    action: 'extended',
  };
}

/**
 * Auto-award Season Champion skin to the overall season winner.
 * This is the rarest skin — only 1 player per division per season gets it.
 * Season champion skin lasts until the end of the next season (90 days).
 *
 * Supports two modes:
 * 1. teamId mode: awards skin to all team members (for tournament-team-based champions)
 * 2. playerId mode: awards skin to a single player (for per-season-points-based champions)
 *
 * @param teamIdOrPlayerId - The winning team's ID OR the champion player's ID
 * @param seasonName - The season name for the reason text
 * @param adminId - The admin who triggered the award
 * @param mode - 'team' (default, backward compatible) or 'player'
 * @returns Array of results for each player processed
 */
export async function autoAwardSeasonChampionSkins(
  teamIdOrPlayerId: string,
  seasonName: string,
  adminId: string,
  mode: 'team' | 'player' = 'team'
): Promise<AutoAwardResult[]> {
  const results: AutoAwardResult[] = [];

  const skin = await db.skin.findUnique({
    where: { type: 'season_champion' },
  });

  if (!skin) {
    console.warn('[skin-auto-award] season_champion skin not found in database — skipping');
    return results;
  }

  // Season champion skin lasts 90 days (entire next season)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  if (mode === 'player') {
    // Single player mode — award to the champion player directly
    const player = await db.player.findUnique({
      where: { id: teamIdOrPlayerId },
      select: {
        id: true,
        gamertag: true,
        account: { select: { id: true } },
      },
    });

    if (!player) return results;

    const accountId = player.account?.id;

    if (!accountId) {
      results.push({
        playerId: player.id,
        gamertag: player.gamertag,
        skinType: 'season_champion',
        displayName: skin.displayName,
        action: 'skipped_no_account',
      });
      return results;
    }

    const result = await awardOrExtendSkin({
      accountId,
      skinId: skin.id,
      skinType: 'season_champion',
      displayName: skin.displayName,
      gamertag: player.gamertag,
      playerId: player.id,
      reason: `Season Champion ${seasonName}`,
      expiresAt,
      awardedBy: adminId,
    });

    results.push(result);
  } else {
    // Team mode — award to all team members (legacy behavior)
    const team = await db.team.findUnique({
      where: { id: teamIdOrPlayerId },
      include: {
        teamPlayers: {
          include: {
            player: {
              select: {
                id: true,
                gamertag: true,
                account: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!team) return results;

    for (const tp of team.teamPlayers) {
      const player = tp.player;
      const accountId = player.account?.id;

      if (!accountId) {
        results.push({
          playerId: player.id,
          gamertag: player.gamertag,
          skinType: 'season_champion',
          displayName: skin.displayName,
          action: 'skipped_no_account',
        });
        continue;
      }

      const result = await awardOrExtendSkin({
        accountId,
        skinId: skin.id,
        skinType: 'season_champion',
        displayName: skin.displayName,
        gamertag: player.gamertag,
        playerId: player.id,
        reason: `Season Champion ${seasonName}`,
        expiresAt,
        awardedBy: adminId,
      });

      results.push(result);
    }
  }

  return results;
}
