import { db, neonUpdateMany, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { getSafeErrorMessage } from '@/lib/api-error';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/reset
 * Resets tournament data, player points, club points, season data, skins & badges
 * ONLY for the currently active season(s).
 * Completed/closed seasons remain intact with all champion & snapshot data.
 * Keeps: Players, ClubProfiles, ClubMembers, Admins, Accounts, CMS data, Sponsors
 * Resets: PlayerSkins, donorBadgeCount, sawerBadgeTier
 */
export async function POST(request: Request) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const results: Record<string, number> = {};

    // ============================================================
    // STEP 0: Find active season(s) — only reset these
    // ============================================================
    const activeSeasons = await db.season.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    if (activeSeasons.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada season aktif. Tidak ada data yang di-reset.',
        details: results,
      });
    }

    const activeSeasonIds = activeSeasons.map((s) => s.id);

    // ============================================================
    // STEP 1: Find all tournaments in active seasons
    // ============================================================
    const activeTournaments = await db.tournament.findMany({
      where: { seasonId: { in: activeSeasonIds } },
      select: { id: true },
    });
    const activeTournamentIds = activeTournaments.map((t) => t.id);

    // ============================================================
    // STEP 2: Delete tournament-related data (respect foreign key order)
    // Only for tournaments in active seasons
    // ============================================================

    if (activeTournamentIds.length > 0) {
      // 2a. PlayerAchievement — only for active season tournaments
      if (isPostgreSQL) {
        results.playerAchievement = await neonDeleteMany('PlayerAchievement',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.playerAchievement = (
          await db.playerAchievement.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2b. TournamentPrize — only for active season tournaments
      if (isPostgreSQL) {
        results.tournamentPrize = await neonDeleteMany('TournamentPrize',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.tournamentPrize = (
          await db.tournamentPrize.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2c. TournamentSponsor — only for active season tournaments
      if (isPostgreSQL) {
        results.tournamentSponsor = await neonDeleteMany('TournamentSponsor',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.tournamentSponsor = (
          await db.tournamentSponsor.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2d. SponsoredPrize — only for active season tournaments
      if (isPostgreSQL) {
        results.sponsoredPrize = await neonDeleteMany('SponsoredPrize',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.sponsoredPrize = (
          await db.sponsoredPrize.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2e. Match — only for active season tournaments
      if (isPostgreSQL) {
        results.match = await neonDeleteMany('Match',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.match = (
          await db.match.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2f. TeamPlayer — must delete before Team (foreign key)
      // Find team IDs in active tournaments first
      const activeTeams = await db.team.findMany({
        where: { tournamentId: { in: activeTournamentIds } },
        select: { id: true },
      });
      const activeTeamIds = activeTeams.map((t) => t.id);

      if (activeTeamIds.length > 0) {
        if (isPostgreSQL) {
          results.teamPlayer = await neonDeleteMany('TeamPlayer',
            [{ column: 'teamId', operator: 'IN', value: activeTeamIds }],
          );
        } else {
          results.teamPlayer = (
            await db.teamPlayer.deleteMany({
              where: { teamId: { in: activeTeamIds } },
            })
          ).count;
        }
      }

      // 2g. Team — only for active season tournaments
      if (isPostgreSQL) {
        results.team = await neonDeleteMany('Team',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.team = (
          await db.team.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2h. Participation — only for active season tournaments
      if (isPostgreSQL) {
        results.participation = await neonDeleteMany('Participation',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.participation = (
          await db.participation.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2i. WaRegistration — only for active season tournaments
      if (isPostgreSQL) {
        results.waRegistration = await neonDeleteMany('WaRegistration',
          [{ column: 'tournamentId', operator: 'IN', value: activeTournamentIds }],
        );
      } else {
        results.waRegistration = (
          await db.waRegistration.deleteMany({
            where: { tournamentId: { in: activeTournamentIds } },
          })
        ).count;
      }

      // 2j. Tournament — only for active seasons
      if (isPostgreSQL) {
        results.tournament = await neonDeleteMany('Tournament',
          [{ column: 'seasonId', operator: 'IN', value: activeSeasonIds }],
        );
      } else {
        results.tournament = (
          await db.tournament.deleteMany({
            where: { seasonId: { in: activeSeasonIds } },
          })
        ).count;
      }
    }

    // ============================================================
    // STEP 3: Delete PlayerPoint records for active seasons
    // ============================================================
    if (isPostgreSQL) {
      results.playerPoint = await neonDeleteMany('PlayerPoint',
        [{ column: 'seasonId', operator: 'IN', value: activeSeasonIds }],
      );
    } else {
      results.playerPoint = (
        await db.playerPoint.deleteMany({
          where: { seasonId: { in: activeSeasonIds } },
        })
      ).count;
    }

    // ============================================================
    // STEP 4: Delete donations for active seasons
    // ============================================================
    if (isPostgreSQL) {
      results.donation = await neonDeleteMany('Donation',
        [{ column: 'seasonId', operator: 'IN', value: activeSeasonIds }],
      );
    } else {
      results.donation = (
        await db.donation.deleteMany({
          where: { seasonId: { in: activeSeasonIds } },
        })
      ).count;
    }

    // ============================================================
    // STEP 5: Delete PlayerSeasonStats for active seasons
    // Then reset ALL Player flat stats to 0
    // (Completed season stats are preserved as historical records,
    //  but the displayed points/wins/etc on the Player record are
    //  reset to 0 — admin expects a full clean slate after reset)
    // ============================================================
    if (isPostgreSQL) {
      results.playerSeasonStats = await neonDeleteMany('PlayerSeasonStats',
        [{ column: 'seasonId', operator: 'IN', value: activeSeasonIds }],
      );
    } else {
      results.playerSeasonStats = (
        await db.playerSeasonStats.deleteMany({
          where: { seasonId: { in: activeSeasonIds } },
        })
      ).count;
    }

    // Reset ALL player flat stats to zero — regardless of completed season history
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp, use raw SQL
    if (isPostgreSQL) {
      const playerResetCount = await neonUpdateMany('Player', [], {
        points: 0,
        totalWins: 0,
        totalMvp: 0,
        streak: 0,
        maxStreak: 0,
        matches: 0,
        tier: 'B',
      });
      results.playersReset = playerResetCount;
    } else {
      const playerReset = await db.player.updateMany({
        data: {
          points: 0,
          totalWins: 0,
          totalMvp: 0,
          streak: 0,
          maxStreak: 0,
          matches: 0,
          tier: 'B',
        },
      });
      results.playersReset = playerReset.count;
    }

    // ============================================================
    // STEP 6: Reset Club entries for active seasons only
    // Club entries belong to a specific season (profileId + seasonId + division)
    // ============================================================
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      const clubUpdateCount = await neonUpdateMany('Club',
        [{ column: 'seasonId', operator: 'IN', value: activeSeasonIds }],
        { points: 0, wins: 0, losses: 0, gameDiff: 0 },
      );
      results.clubsReset = clubUpdateCount;
    } else {
      const clubUpdate = await db.club.updateMany({
        where: { seasonId: { in: activeSeasonIds } },
        data: {
          points: 0,
          wins: 0,
          losses: 0,
          gameDiff: 0,
        },
      });
      results.clubsReset = clubUpdate.count;
    }

    // ============================================================
    // STEP 7: Reset only active seasons — clear champion/snapshot
    // Completed seasons are LEFT UNTOUCHED
    // ============================================================
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      const seasonUpdateCount = await neonUpdateMany('Season',
        [{ column: 'status', operator: '=', value: 'active' }],
        { championPlayerId: null, championPlayerPoints: null, championPlayerSnapshot: null, championSquad: null },
      );
      results.seasonsReset = seasonUpdateCount;
    } else {
      const seasonUpdate = await db.season.updateMany({
        where: { status: 'active' },
        data: {
          championPlayerId: null,
          championPlayerPoints: null,
          championPlayerSnapshot: null,
          championSquad: null,
        },
      });
      results.seasonsReset = seasonUpdate.count;
    }

    // ============================================================
    // STEP 8: Reset skins & badges for active season participants
    // - Delete PlayerSkin records (awarded skins)
    // - Reset Account.donorBadgeCount & sawerBadgeTier
    // - Delete PlayerAchievement for non-tournament achievements in active seasons
    // ============================================================

    // 9a. Delete all PlayerSkin records (awarded badges/skins)
    // These are explicitly granted skins (season_champion, champion, mvp, donor, etc.)
    // Virtual skins (derived from tournaments/seasons) are already gone after Step 2-8
    if (isPostgreSQL) {
      results.playerSkins = await neonDeleteMany('PlayerSkin', []);
    } else {
      results.playerSkins = (
        await db.playerSkin.deleteMany({})
      ).count;
    }

    // 9b. Reset donor badge counts and sawer badge tiers on all Accounts
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      const badgeResetCount = await neonUpdateMany('Account', [],
        { donorBadgeCount: 0, sawerBadgeTier: 'none' },
      );
      results.badgesReset = badgeResetCount;
    } else {
      const badgeReset = await db.account.updateMany({
        data: {
          donorBadgeCount: 0,
          sawerBadgeTier: 'none',
        },
      });
      results.badgesReset = badgeReset.count;
    }

    // ============================================================
    // AUDIT LOG
    // ============================================================
    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'reseed',
      entity: 'admin',
      details: `Reset poin, data turnamen, skin & badge untuk season aktif (${activeSeasonIds.join(', ')}). Season completed tidak terpengaruh.`,
      metadata: results,
    });

    return NextResponse.json({
      success: true,
      message: `Data turnamen season aktif berhasil di-reset! Semua poin pemain di-nol-kan, skin & badge di-reset. Season yang sudah completed tetap utuh sebagai arsip.`,
      details: results,
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Reset error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
