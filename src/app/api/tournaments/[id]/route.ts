import { db, neonUpdateMany, neonTransaction, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { wibToUTC } from '@/lib/utils';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const tournament = await db.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      division: true,
      seasonId: true,
      matches: {
        where: { status: 'completed', winnerId: { not: null } },
        select: {
          id: true,
          team1Id: true,
          team2Id: true,
          winnerId: true,
          loserId: true,
          score1: true,
          score2: true,
          team1: { select: { id: true, teamPlayers: { select: { playerId: true } } } },
          team2: { select: { id: true, teamPlayers: { select: { playerId: true } } } },
        },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tournament.status === 'completed') {
    return NextResponse.json({ error: 'Tournament yang sudah completed tidak bisa dihapus. Hubungi super admin untuk rollback.' }, { status: 400 });
  }

  try {
    // ─── Step 1: Rollback player points (batch) ───
    const pointRecords = await db.playerPoint.findMany({
      where: { tournamentId: id },
      select: { playerId: true, amount: true },
    });

    // Group by player and sum amounts to deduct
    const pointsByPlayer = new Map<string, number>();
    for (const pr of pointRecords) {
      pointsByPlayer.set(pr.playerId, (pointsByPlayer.get(pr.playerId) || 0) + pr.amount);
    }

    // Batch update player points — one update per player
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp;
    // since this targets a single player by ID, use update() instead
    for (const [playerId, totalPoints] of pointsByPlayer) {
      if (isPostgreSQL) {
        await db.$executeRawUnsafe('UPDATE "Player" SET points = points - $1 WHERE id = $2', totalPoints, playerId);
      } else {
        await db.player.update({
          where: { id: playerId },
          data: { points: { decrement: totalPoints } },
        });
      }
      // Clamp to 0 if negative (decrement can go below 0)
      await db.$executeRaw`UPDATE "Player" SET points = MAX(points, 0) WHERE id = ${playerId} AND points < 0`;
    }

    // ─── Step 2: Rollback match/wins/streak stats (batch) ───
    // Collect all player stat changes first, then apply in batch
    const playerStatChanges = new Map<string, { winsDelta: number; matchesDelta: number }>();

    for (const match of tournament.matches) {
      if (!match.team1 || !match.team2) continue;
      if (!match.winnerId) continue;

      const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
      // loserId can be null (e.g., bye match), determine loser by elimination
      const losingTeam = match.loserId
        ? (match.team1Id === match.loserId ? match.team1 : match.team2)
        : (match.team1Id === match.winnerId ? match.team2 : match.team1);

      if (!losingTeam) continue;

      // Winning team players: -1 win, -1 match
      for (const tp of winningTeam.teamPlayers) {
        const existing = playerStatChanges.get(tp.playerId) || { winsDelta: 0, matchesDelta: 0 };
        existing.winsDelta -= 1;
        existing.matchesDelta -= 1;
        playerStatChanges.set(tp.playerId, existing);
      }

      // Losing team players: -1 match
      for (const tp of losingTeam.teamPlayers) {
        const existing = playerStatChanges.get(tp.playerId) || { winsDelta: 0, matchesDelta: 0 };
        existing.matchesDelta -= 1;
        playerStatChanges.set(tp.playerId, existing);
      }
    }

    // Apply player stat changes in batch
    for (const [playerId, changes] of playerStatChanges) {
      await db.player.update({
        where: { id: playerId },
        data: {
          ...(changes.winsDelta !== 0 && { totalWins: { increment: changes.winsDelta } }),
          ...(changes.matchesDelta !== 0 && { matches: { increment: changes.matchesDelta } }),
          streak: 0,
        },
      });
      // Clamp to 0
      await db.$executeRaw`UPDATE "Player" SET "totalWins" = MAX("totalWins", 0), matches = MAX(matches, 0) WHERE id = ${playerId} AND ("totalWins" < 0 OR matches < 0)`;
    }

    // ─── Step 3: Rollback club stats (batch) ───
    // Collect club stat changes per club
    const clubStatChanges = new Map<string, { winsDelta: number; lossesDelta: number; pointsDelta: number; gameDiffDelta: number }>();

    for (const match of tournament.matches) {
      if (!match.team1 || !match.team2) continue;
      if (!match.winnerId) continue;

      const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
      const losingTeam = match.loserId
        ? (match.team1Id === match.loserId ? match.team1 : match.team2)
        : (match.team1Id === match.winnerId ? match.team2 : match.team1);

      if (!losingTeam) continue;

      const gameDiff = Math.abs((match.score1 || 0) - (match.score2 || 0));

      // Get club memberships for all players in this match
      const allPlayerIds = [
        ...winningTeam.teamPlayers.map(tp => tp.playerId),
        ...losingTeam.teamPlayers.map(tp => tp.playerId),
      ];

      const memberships = await db.clubMember.findMany({
        where: {
          playerId: { in: allPlayerIds },
          leftAt: null,
          profile: { seasonEntries: { some: { division: tournament.division, seasonId: tournament.seasonId } } },
        },
        include: { profile: { include: { seasonEntries: { where: { division: tournament.division, seasonId: tournament.seasonId } } } } },
      });

      const winningPlayerIds = new Set(winningTeam.teamPlayers.map(tp => tp.playerId));

      for (const membership of memberships) {
        const clubEntry = membership.profile.seasonEntries[0];
        if (!clubEntry) continue;
        const isWinner = winningPlayerIds.has(membership.playerId);
        const existing = clubStatChanges.get(clubEntry.id) || { winsDelta: 0, lossesDelta: 0, pointsDelta: 0, gameDiffDelta: 0 };

        if (isWinner) {
          existing.winsDelta -= 1;
          existing.pointsDelta -= 2;
          existing.gameDiffDelta -= gameDiff;
        } else {
          existing.lossesDelta -= 1;
          existing.gameDiffDelta += gameDiff;
        }
        clubStatChanges.set(clubEntry.id, existing);
      }
    }

    // Apply club stat changes in batch
    for (const [clubId, changes] of clubStatChanges) {
      await db.club.update({
        where: { id: clubId },
        data: {
          ...(changes.winsDelta !== 0 && { wins: { increment: changes.winsDelta } }),
          ...(changes.lossesDelta !== 0 && { losses: { increment: changes.lossesDelta } }),
          ...(changes.pointsDelta !== 0 && { points: { increment: changes.pointsDelta } }),
          ...(changes.gameDiffDelta !== 0 && { gameDiff: { increment: changes.gameDiffDelta } }),
        },
      });
    }

    // ─── Step 4: Delete all tournament data ───
    // Use separate small transactions to avoid Neon timeout
    // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
    await neonTransaction(async (tx) => {
      if (isPostgreSQL) {
        await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
      } else {
        await tx.match.deleteMany({ where: { tournamentId: id } });
      }
    });

    await neonTransaction(async (tx) => {
      const teams = await tx.team.findMany({ where: { tournamentId: id }, select: { id: true } });
      for (const t of teams) {
        if (isPostgreSQL) {
          await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: '=', value: t.id }], tx);
        } else {
          await tx.teamPlayer.deleteMany({ where: { teamId: t.id } });
        }
      }
      if (isPostgreSQL) {
        await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }], tx);
      } else {
        await tx.team.deleteMany({ where: { tournamentId: id } });
      }
    });

    await neonTransaction(async (tx) => {
      if (isPostgreSQL) {
        await neonDeleteMany('TournamentPrize', [{ column: 'tournamentId', operator: '=', value: id }], tx);
        await neonDeleteMany('Donation', [{ column: 'tournamentId', operator: '=', value: id }], tx);
        await neonDeleteMany('Participation', [{ column: 'tournamentId', operator: '=', value: id }], tx);
        await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }], tx);
        await neonDeleteMany('PlayerAchievement', [{ column: 'tournamentId', operator: '=', value: id }], tx);
        await neonDeleteMany('TournamentSponsor', [{ column: 'tournamentId', operator: '=', value: id }], tx);
        await neonDeleteMany('SponsoredPrize', [{ column: 'tournamentId', operator: '=', value: id }], tx);
      } else {
        await tx.tournamentPrize.deleteMany({ where: { tournamentId: id } });
        await tx.donation.deleteMany({ where: { tournamentId: id } });
        await tx.participation.deleteMany({ where: { tournamentId: id } });
        await tx.playerPoint.deleteMany({ where: { tournamentId: id } });
        await tx.playerAchievement.deleteMany({ where: { tournamentId: id } });
        await tx.tournamentSponsor.deleteMany({ where: { tournamentId: id } });
        await tx.sponsoredPrize.deleteMany({ where: { tournamentId: id } });
      }
      await tx.tournament.delete({ where: { id } });
    });

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'delete',
      entity: 'tournament',
      entityId: id,
      details: `Delete tournament`,
    });

    // Purge CDN cache so dashboard reflects tournament removal
    revalidateTag('league-data', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete tournament error:', error);
    return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id } = await params;
  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      season: true,
      teams: {
        include: {
          teamPlayers: { include: { player: true } },
          matchAsTeam1: { include: { team2: true, winner: true } },
          matchAsTeam2: { include: { team1: true, winner: true } },
        },
        orderBy: { rank: 'asc' },
      },
      matches: {
        include: {
          team1: { include: { teamPlayers: { include: { player: true } } } },
          team2: { include: { teamPlayers: { include: { player: true } } } },
          winner: true,
          loser: true,
          mvpPlayer: true,
        },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      },
      participations: {
        include: { player: true },
        orderBy: { createdAt: 'asc' },
      },
      prizes: { orderBy: { position: 'asc' } },
      donations: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { headers,  status: 404 });
  }

  return NextResponse.json(tournament, { headers });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();

  const validStatuses = ['setup', 'registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization', 'completed'];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const validFormats = ['single_elimination', 'group_stage', 'swiss', 'upper_semi'];
  if (body.format && !validFormats.includes(body.format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  // ─── Handle status reversion (cleanup data from later phases) ───
  if (body._revert && body.status) {
    const statusOrder = ['setup', 'registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization', 'completed'];
    const currentTournament = await db.tournament.findUnique({
      where: { id },
      select: { status: true, division: true, seasonId: true },
    });
    if (currentTournament) {
      const targetIdx = statusOrder.indexOf(body.status);

      // ─── SAFETY CHECK: Detect and clean up inconsistent state when reverting ───
      // When reverting, check for data that is inconsistent with the target state.
      // Do NOT reset currentTournament.status here — the revert phases and final status update handle that.
      // Resetting currentTournament.status would change currentIdx, causing phase conditions
      // (e.g., Phase 4's "currentIdx >= team_generation") to fail, skipping necessary cleanup.
      if (['team_generation', 'bracket_generation', 'main_event', 'finalization'].includes(currentTournament.status)) {
        const teamCount = await db.team.count({ where: { tournamentId: id } });
        const matchCount = await db.match.count({ where: { tournamentId: id } });

        // When reverting: proactively clean up data that shouldn't exist at the target status.
        // This handles partial rollbacks where a Phase failed and left orphaned data,
        // and the case where tournament is stuck at team_generation with 0 teams.
        if (targetIdx < statusOrder.indexOf('team_generation')) {
          // Target is before team_generation — teams and matches should not exist
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              if (matchCount > 0) {
                console.warn(`Safety check: Found ${matchCount} orphaned matches when reverting to ${body.status}, cleaning up`);
                if (isPostgreSQL) {
                  await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
                } else {
                  await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.match.deleteMany({ where: { tournamentId: id } });
                }
              }
              if (teamCount > 0) {
                console.warn(`Safety check: Found ${teamCount} orphaned teams when reverting to ${body.status}, cleaning up`);
                const teams = await tx.team.findMany({ where: { tournamentId: id }, select: { id: true } });
                for (const t of teams) {
                  if (isPostgreSQL) {
                    await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: '=', value: t.id }], tx);
                  } else {
                    await tx.teamPlayer.deleteMany({ where: { teamId: t.id } });
                  }
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.team.deleteMany({ where: { tournamentId: id } });
                }
              }
              // Reset assigned participations back to approved
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'assigned' }],
                  { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
                );
              } else {
                await tx.participation.updateMany({
                  where: { tournamentId: id, status: 'assigned' },
                  data: { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
                });
              }
            });
          } catch (error) {
            console.error('Safety check cleanup (before team_generation) error:', error);
          }
        } else if (targetIdx < statusOrder.indexOf('bracket_generation')) {
          // Target is between team_generation and bracket_generation — matches should not exist
          try {
            // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              if (matchCount > 0) {
                console.warn(`Safety check: Found ${matchCount} orphaned matches when reverting to ${body.status}, cleaning up`);
                if (isPostgreSQL) {
                  await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
                } else {
                  await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.match.deleteMany({ where: { tournamentId: id } });
                }
              }
            });
          } catch (error) {
            console.error('Safety check cleanup (before bracket_generation) error:', error);
          }
        }

        // Also detect truly inconsistent states: at bracket_generation+ with no teams and no matches.
        // This indicates data was likely lost from a failed operation.
        if (currentTournament.status !== 'team_generation' && teamCount === 0 && matchCount === 0) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // At bracket_generation+ with no teams and no matches — reset participation assignments
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'assigned' }],
                  { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
                );
              } else {
                await tx.participation.updateMany({
                  where: { tournamentId: id, status: 'assigned' },
                  data: { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
                });
              }
              // Don't reset currentTournament.status — let the revert phases handle the status change
            });
          } catch (error) {
            console.error('Safety check cleanup (inconsistent state) error:', error);
          }
        }
      }

      const currentIdx = statusOrder.indexOf(currentTournament.status);
      // targetIdx is already defined above (before the safety check)

      if (targetIdx < currentIdx) {
        const revertErrors: string[] = [];

        try {
        // ─── PHASE 0: Always cleanup orphaned data when reverting ───
        // This handles cases where data from later phases exists even though status is earlier
        // (e.g., from a failed rollback that left the tournament in an inconsistent state)
        if (targetIdx < statusOrder.indexOf('finalization')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Always clean up prizes if they exist but we're reverting before finalization
              const existingPrizes = await tx.tournamentPrize.findMany({ where: { tournamentId: id }, select: { id: true } });
              if (existingPrizes.length > 0) {
                // Rollback any remaining prize point records
                const prizePointRecords = await tx.playerPoint.findMany({
                  where: { tournamentId: id, reason: { in: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] } },
                  select: { playerId: true, amount: true },
                });
                const pointsByPlayer = new Map<string, number>();
                for (const pr of prizePointRecords) {
                  pointsByPlayer.set(pr.playerId, (pointsByPlayer.get(pr.playerId) || 0) + pr.amount);
                }
                for (const [playerId, totalPoints] of pointsByPlayer) {
                  // Neon workaround: updateMany() with decrement → use update() for single-row, or raw SQL
                  if (isPostgreSQL) {
                    await db.$executeRawUnsafe('UPDATE "Player" SET points = points - $1 WHERE id = $2', totalPoints, playerId);
                  } else {
                    await tx.player.updateMany({ where: { id: playerId }, data: { points: { decrement: totalPoints } } });
                  }
                  await tx.$executeRaw`UPDATE "Player" SET points = MAX(points, 0) WHERE id = ${playerId} AND points < 0`;
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] }], tx);
                } else {
                  await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] } } });
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('TournamentPrize', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.tournamentPrize.deleteMany({ where: { tournamentId: id } });
                }
              }

              // Always reset finalizedAt/completedAt if reverting before finalization
              const tournamentData = await tx.tournament.findUnique({ where: { id }, select: { finalizedAt: true, completedAt: true } });
              if (tournamentData?.finalizedAt || tournamentData?.completedAt) {
                await tx.tournament.update({ where: { id }, data: { finalizedAt: null, completedAt: null } });
              }

              // Always rollback any remaining MVP stats
              const mvpParts = await tx.participation.findMany({ where: { tournamentId: id, isMvp: true }, select: { playerId: true } });
              for (const mvp of mvpParts) {
                await tx.player.update({ where: { id: mvp.playerId }, data: { totalMvp: { decrement: 1 } } });
                await tx.$executeRaw`UPDATE "Player" SET "totalMvp" = MAX("totalMvp", 0) WHERE id = ${mvp.playerId} AND "totalMvp" < 0`;
              }

              // Always reset isWinner/isMvp on participations if they shouldn't be set
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'isWinner', operator: '=', value: 'true' }], { isWinner: false });
                await neonUpdateMany('Participation', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'isMvp', operator: '=', value: 'true' }], { isMvp: false });
              } else {
                await tx.participation.updateMany({ where: { tournamentId: id, isWinner: true }, data: { isWinner: false } });
                await tx.participation.updateMany({ where: { tournamentId: id, isMvp: true }, data: { isMvp: false } });
              }

              // Always reset team ranks
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Team', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'rank', operator: 'NOT NULL' }], { rank: null, isWinner: false });
              } else {
                await tx.team.updateMany({ where: { tournamentId: id, rank: { not: null } }, data: { rank: null, isWinner: false } });
              }

              // Always delete orphaned player achievements
              if (isPostgreSQL) {
                await neonDeleteMany('PlayerAchievement', [{ column: 'tournamentId', operator: '=', value: id }], tx);
              } else {
                await tx.playerAchievement.deleteMany({ where: { tournamentId: id } });
              }

              // Always reset match MVP references
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Match', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'mvpPlayerId', operator: 'NOT NULL' }], { mvpPlayerId: null });
              } else {
                await tx.match.updateMany({ where: { tournamentId: id, mvpPlayerId: { not: null } }, data: { mvpPlayerId: null } });
              }
            });
          } catch (phaseError) {
            console.error('Phase 0 (prize rollback) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 0 error');
          }
        }

        // ─── PHASE 1: Rollback finalization effects ───
        // If reverting before finalization (from finalization/completed back to main_event or earlier)
        if (targetIdx < statusOrder.indexOf('finalization') && currentIdx >= statusOrder.indexOf('finalization')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // 1a. Rollback player points from prizes/achievements
              const prizePointRecords = await tx.playerPoint.findMany({
                where: { tournamentId: id, reason: { in: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] } },
                select: { playerId: true, amount: true, reason: true },
              });
              const prizePointsByPlayer = new Map<string, number>();
              for (const pr of prizePointRecords) {
                prizePointsByPlayer.set(pr.playerId, (prizePointsByPlayer.get(pr.playerId) || 0) + pr.amount);
              }
              for (const [playerId, totalPoints] of prizePointsByPlayer) {
                // Neon workaround: updateMany() with decrement → raw SQL on PostgreSQL
                if (isPostgreSQL) {
                  await db.$executeRawUnsafe('UPDATE "Player" SET points = points - $1 WHERE id = $2', totalPoints, playerId);
                } else {
                  await tx.player.updateMany({
                    where: { id: playerId },
                    data: { points: { decrement: totalPoints } },
                  });
                }
                await tx.$executeRaw`UPDATE "Player" SET points = MAX(points, 0) WHERE id = ${playerId} AND points < 0`;
              }
              if (isPostgreSQL) {
                await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] }], tx);
              } else {
                await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] } } });
              }

              // 1b. Rollback MVP totalMvp
              const mvpParticipations = await tx.participation.findMany({
                where: { tournamentId: id, isMvp: true },
                select: { playerId: true },
              });
              for (const mvp of mvpParticipations) {
                await tx.player.update({
                  where: { id: mvp.playerId },
                  data: { totalMvp: { decrement: 1 } },
                });
                await tx.$executeRaw`UPDATE "Player" SET "totalMvp" = MAX("totalMvp", 0) WHERE id = ${mvp.playerId} AND "totalMvp" < 0`;
              }

              // 1c. Reset team ranks and isWinner
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Team', [{ column: 'tournamentId', operator: '=', value: id }], { rank: null, isWinner: false });
              } else {
                await tx.team.updateMany({
                  where: { tournamentId: id },
                  data: { rank: null, isWinner: false },
                });
              }

              // 1d. Reset participation isWinner, isMvp, and rollback prize pointsEarned
              // Use prizePointsByPlayer captured BEFORE deletion (step 1a) to calculate participation deductions
              // Note: prizePointsByPlayer includes tier_upgrade_bonus, so we filter to just prize reasons
              const prizeEarningsByPlayer = new Map<string, number>();
              for (const pr of prizePointRecords) {
                if (['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other'].includes(pr.reason)) {
                  prizeEarningsByPlayer.set(pr.playerId, (prizeEarningsByPlayer.get(pr.playerId) || 0) + pr.amount);
                }
              }

              const allParticipations = await tx.participation.findMany({
                where: { tournamentId: id },
                select: { id: true, playerId: true, pointsEarned: true, isMvp: true, isWinner: true },
              });
              for (const part of allParticipations) {
                const prizePts = prizeEarningsByPlayer.get(part.playerId) || 0;
                await tx.participation.update({
                  where: { id: part.id },
                  data: {
                    isMvp: false,
                    isWinner: false,
                    pointsEarned: Math.max(0, part.pointsEarned - prizePts),
                  },
                });
              }

              // 1e. Delete prizes and achievements
              if (isPostgreSQL) {
                await neonDeleteMany('TournamentPrize', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                await neonDeleteMany('PlayerAchievement', [{ column: 'tournamentId', operator: '=', value: id }], tx);
              } else {
                await tx.tournamentPrize.deleteMany({ where: { tournamentId: id } });
                await tx.playerAchievement.deleteMany({ where: { tournamentId: id } });
              }

              // 1f. Reset match MVP references
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Match', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'mvpPlayerId', operator: 'NOT NULL' }], { mvpPlayerId: null });
              } else {
                await tx.match.updateMany({
                  where: { tournamentId: id, mvpPlayerId: { not: null } },
                  data: { mvpPlayerId: null },
                });
              }

              // 1g. Reset finalizedAt
              await tx.tournament.update({
                where: { id },
                data: { finalizedAt: null, completedAt: null },
              });
            });
          } catch (phaseError) {
            console.error('Phase 1 (finalization rollback) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 1 error');
          }
        }

        // ─── PHASE 2: Rollback match results (when reverting before main_event) ───
        // If reverting to bracket_generation or earlier from main_event/finalization/completed
        if (targetIdx < statusOrder.indexOf('main_event') && currentIdx >= statusOrder.indexOf('main_event')) {
          // Get all completed matches for rollback (read-only data gathering)
          const completedMatches = await db.match.findMany({
            where: { tournamentId: id, status: 'completed' },
            select: {
              id: true,
              team1Id: true,
              team2Id: true,
              winnerId: true,
              loserId: true,
              score1: true,
              score2: true,
              team1: { select: { id: true, teamPlayers: { select: { playerId: true } } } },
              team2: { select: { id: true, teamPlayers: { select: { playerId: true } } } },
            },
          });

          // Pre-compute match point data for Phase 2c participation reset
          // (Phase 2a will delete these records, so we must capture before)
          const matchPointsForParticipation = await db.playerPoint.findMany({
            where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } },
            select: { playerId: true, amount: true },
          });
          const matchEarningsByPlayer = new Map<string, number>();
          for (const pr of matchPointsForParticipation) {
            matchEarningsByPlayer.set(pr.playerId, (matchEarningsByPlayer.get(pr.playerId) || 0) + pr.amount);
          }

          // 2a. Rollback player match stats using PlayerPoint audit trail
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              const matchPointRecords = await tx.playerPoint.findMany({
                where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } },
                select: { playerId: true, amount: true },
              });
              const matchPointsByPlayer = new Map<string, number>();
              for (const pr of matchPointRecords) {
                matchPointsByPlayer.set(pr.playerId, (matchPointsByPlayer.get(pr.playerId) || 0) + pr.amount);
              }
              for (const [playerId, totalPoints] of matchPointsByPlayer) {
                // Neon workaround: updateMany() with decrement → raw SQL on PostgreSQL
                if (isPostgreSQL) {
                  await db.$executeRawUnsafe('UPDATE "Player" SET points = points - $1 WHERE id = $2', totalPoints, playerId);
                } else {
                  await tx.player.updateMany({
                    where: { id: playerId },
                    data: { points: { decrement: totalPoints } },
                  });
                }
                await tx.$executeRaw`UPDATE "Player" SET points = MAX(points, 0) WHERE id = ${playerId} AND points < 0`;
              }
              if (isPostgreSQL) {
                await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
              } else {
                await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
              }
            });
          } catch (phaseError) {
            console.error('Phase 2a (match point rollback) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 2a error');
          }

          // 2b. Rollback player wins/matches/streak stats + club stats
          // Compute player stat deltas from already-fetched completedMatches
          const playerStatChanges = new Map<string, { winsDelta: number; matchesDelta: number }>();
          for (const match of completedMatches) {
            if (!match.team1 || !match.team2 || !match.winnerId) continue;
            const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
            const losingTeam = match.loserId
              ? (match.team1Id === match.loserId ? match.team1 : match.team2)
              : (match.team1Id === match.winnerId ? match.team2 : match.team1);
            if (!losingTeam) continue;
            for (const tp of winningTeam.teamPlayers) {
              const existing = playerStatChanges.get(tp.playerId) || { winsDelta: 0, matchesDelta: 0 };
              existing.winsDelta -= 1;
              existing.matchesDelta -= 1;
              playerStatChanges.set(tp.playerId, existing);
            }
            for (const tp of losingTeam.teamPlayers) {
              const existing = playerStatChanges.get(tp.playerId) || { winsDelta: 0, matchesDelta: 0 };
              existing.matchesDelta -= 1;
              playerStatChanges.set(tp.playerId, existing);
            }
          }

          // Compute club stat deltas (requires DB reads for club memberships)
          const clubStatChanges = new Map<string, { winsDelta: number; lossesDelta: number; pointsDelta: number; gameDiffDelta: number }>();
          for (const match of completedMatches) {
            if (!match.team1 || !match.team2 || !match.winnerId) continue;
            const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
            const losingTeam = match.loserId
              ? (match.team1Id === match.loserId ? match.team1 : match.team2)
              : (match.team1Id === match.winnerId ? match.team2 : match.team1);
            if (!losingTeam) continue;
            const gameDiff = Math.abs((match.score1 || 0) - (match.score2 || 0));
            const allPlayerIds = [
              ...winningTeam.teamPlayers.map(tp => tp.playerId),
              ...losingTeam.teamPlayers.map(tp => tp.playerId),
            ];
            const memberships = await db.clubMember.findMany({
              where: {
                playerId: { in: allPlayerIds },
                leftAt: null,
                profile: { seasonEntries: { some: { division: currentTournament.division, seasonId: currentTournament.seasonId } } },
              },
              include: { profile: { include: { seasonEntries: { where: { division: currentTournament.division, seasonId: currentTournament.seasonId } } } } },
            });
            const winningPlayerIds = new Set(winningTeam.teamPlayers.map(tp => tp.playerId));
            for (const membership of memberships) {
              const clubEntry = membership.profile.seasonEntries[0];
              if (!clubEntry) continue;
              const isWinner = winningPlayerIds.has(membership.playerId);
              const existing = clubStatChanges.get(clubEntry.id) || { winsDelta: 0, lossesDelta: 0, pointsDelta: 0, gameDiffDelta: 0 };
              if (isWinner) {
                existing.winsDelta -= 1;
                existing.pointsDelta -= 2;
                existing.gameDiffDelta -= gameDiff;
              } else {
                existing.lossesDelta -= 1;
                existing.gameDiffDelta += gameDiff;
              }
              clubStatChanges.set(clubEntry.id, existing);
            }
          }

          try {
            // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Apply player stat changes
              for (const [playerId, changes] of playerStatChanges) {
                await tx.player.update({
                  where: { id: playerId },
                  data: {
                    ...(changes.winsDelta !== 0 && { totalWins: { increment: changes.winsDelta } }),
                    ...(changes.matchesDelta !== 0 && { matches: { increment: changes.matchesDelta } }),
                    streak: 0,
                  },
                });
                await tx.$executeRaw`UPDATE "Player" SET "totalWins" = MAX("totalWins", 0), matches = MAX(matches, 0) WHERE id = ${playerId} AND ("totalWins" < 0 OR matches < 0)`;
              }

              // Apply club stat changes
              for (const [clubId, changes] of clubStatChanges) {
                await tx.club.update({
                  where: { id: clubId },
                  data: {
                    ...(changes.winsDelta !== 0 && { wins: { increment: changes.winsDelta } }),
                    ...(changes.lossesDelta !== 0 && { losses: { increment: changes.lossesDelta } }),
                    ...(changes.pointsDelta !== 0 && { points: { increment: changes.pointsDelta } }),
                    ...(changes.gameDiffDelta !== 0 && { gameDiff: { increment: changes.gameDiffDelta } }),
                  },
                });
              }
            });
          } catch (phaseError) {
            console.error('Phase 2b (player+club stat rollback) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 2b error');
          }

          // 2c. Reset participation pointsEarned from match points + bracket reset
          // Uses matchEarningsByPlayer pre-computed before Phase 2a (which deleted those records)
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Reset participation pointsEarned from match points
              const allParts = await tx.participation.findMany({
                where: { tournamentId: id },
                select: { id: true, playerId: true, pointsEarned: true },
              });
              for (const part of allParts) {
                const matchPts = matchEarningsByPlayer.get(part.playerId) || 0;
                if (matchPts > 0) {
                  await tx.participation.update({
                    where: { id: part.id },
                    data: { pointsEarned: Math.max(0, part.pointsEarned - matchPts) },
                  });
                }
              }

              // If reverting to bracket_generation: reset match scores but keep bracket structure
              if (targetIdx === statusOrder.indexOf('bracket_generation')) {
                // Reset all matches to their original state
                // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
                if (isPostgreSQL) {
                  await neonUpdateMany('Match',
                    [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'completed' }],
                    { score1: null, score2: null, status: 'pending', winnerId: null, loserId: null, completedAt: null, mvpPlayerId: null },
                  );
                } else {
                  await tx.match.updateMany({
                    where: { tournamentId: id, status: 'completed' },
                    data: {
                      score1: null,
                      score2: null,
                      status: 'pending',
                      winnerId: null,
                      loserId: null,
                      completedAt: null,
                      mvpPlayerId: null,
                    },
                  });
                }
                // Mark matches with both teams as 'ready'
                const matchesWithTeams = await tx.match.findMany({
                  where: { tournamentId: id, team1Id: { not: null }, team2Id: { not: null }, status: 'pending' },
                  select: { id: true },
                });
                for (const m of matchesWithTeams) {
                  await tx.match.update({ where: { id: m.id }, data: { status: 'ready' } });
                }
                // Clear team assignments from later rounds (teams advanced from completed matches)
                const laterMatches = await tx.match.findMany({
                  where: { tournamentId: id, status: 'pending', bracket: { in: ['upper', 'lower', 'grand_final'] } },
                  select: { id: true, round: true, bracket: true, groupLabel: true, team1Id: true, team2Id: true },
                });
                // Don't clear teams from round 1 upper bracket matches (those are the original bracket)
                // or group stage matches (those are set at generation time)
                // Only clear teams from rounds > 1 that were filled by advancement
                for (const m of laterMatches) {
                  if (m.bracket === 'group') continue; // Group stage teams are set at generation
                  if (m.bracket === 'upper' && m.round === 1) continue; // R1 upper teams are original
                  await tx.match.update({
                    where: { id: m.id },
                    data: { team1Id: null, team2Id: null, status: 'pending' },
                  });
                }
              }
            });
          } catch (phaseError) {
            console.error('Phase 2c (participation+bracket reset) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 2c error');
          }
        }

        // ─── PHASE 3: Delete all matches (when reverting before bracket_generation) ───
        if (targetIdx < statusOrder.indexOf('bracket_generation') && currentIdx >= statusOrder.indexOf('bracket_generation')) {
          // Only do match stat rollback if we didn't already do it in Phase 2
          // Phase 2 only runs when targetIdx >= main_event index
          // If we're reverting from main_event+ to before bracket_generation, Phase 2 already ran
          // But if we're reverting from bracket_generation itself (no matches played), we just need to delete

          try {
            // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Delete match point records (if any remain)
              if (isPostgreSQL) {
                await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
              } else {
                await tx.playerPoint.deleteMany({
                  where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } },
                });
              }

              if (isPostgreSQL) {
                await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
              } else {
                await tx.match.deleteMany({ where: { tournamentId: id } });
              }
            });
          } catch (phaseError) {
            console.error('Phase 3 (delete matches) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 3 error');
          }
        }

        // ─── PHASE 4: Delete all teams (when reverting before team_generation) ───
        if (targetIdx < statusOrder.indexOf('team_generation') && currentIdx >= statusOrder.indexOf('team_generation')) {
          try {
            // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              const teams = await tx.team.findMany({ where: { tournamentId: id }, select: { id: true } });
              for (const t of teams) {
                if (isPostgreSQL) {
                  await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: '=', value: t.id }], tx);
                } else {
                  await tx.teamPlayer.deleteMany({ where: { teamId: t.id } });
                }
              }
              if (isPostgreSQL) {
                await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }], tx);
              } else {
                await tx.team.deleteMany({ where: { tournamentId: id } });
              }
            });
          } catch (phaseError) {
            console.error('Phase 4 (delete teams) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 4 error');
          }
        }

        // ─── PHASE 5: Reset participations (when reverting before approval) ───
        if (targetIdx < statusOrder.indexOf('approval') && currentIdx >= statusOrder.indexOf('approval')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: 'IN', value: ['approved', 'assigned'] }],
                  { status: 'registered', tierOverride: null, pointsEarned: 0, isMvp: false, isWinner: false },
                );
              } else {
                await tx.participation.updateMany({
                  where: { tournamentId: id, status: { in: ['approved', 'assigned'] } },
                  data: { status: 'registered', tierOverride: null, pointsEarned: 0, isMvp: false, isWinner: false },
                });
              }
            });
          } catch (phaseError) {
            console.error('Phase 5 (reset participations) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 5 error');
          }
        }

        // ─── PHASE 6: Reset participation when reverting before team_generation ───
        if (targetIdx < statusOrder.indexOf('team_generation') && currentIdx >= statusOrder.indexOf('team_generation')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }],
                  { pointsEarned: 0, isMvp: false, isWinner: false },
                );
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'assigned' }],
                  { status: 'approved' },
                );
              } else {
                await tx.participation.updateMany({
                  where: { tournamentId: id },
                  data: { pointsEarned: 0, isMvp: false, isWinner: false },
                });
                // Reset assigned participations back to approved (team generation sets status to 'assigned')
                await tx.participation.updateMany({
                  where: { tournamentId: id, status: 'assigned' },
                  data: { status: 'approved' },
                });
              }
            });
          } catch (phaseError) {
            console.error('Phase 6 (reset participation before team_generation) error:', phaseError);
            revertErrors.push(phaseError instanceof Error ? phaseError.message : 'Unknown Phase 6 error');
          }
        }

        // ─── ORPHANED DATA CLEANUP: Final safety net ───
        // After all revert phases, ALWAYS verify data consistency for the target status.
        // This handles cases where:
        // 1. A previous partial revert changed the status but left orphaned data
        // 2. The phase conditions (which check currentIdx) skipped cleanup due to status mismatch
        // 3. A failed operation left the tournament in an inconsistent state
        // We check ACTUAL data existence, not just currentIdx, to be fully defensive.

        // Target before team_generation: No teams or matches should exist
        if (targetIdx < statusOrder.indexOf('team_generation')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              const orphanedTeams = await tx.team.findMany({ where: { tournamentId: id }, select: { id: true } });
              if (orphanedTeams.length > 0) {
                console.warn(`Orphaned data cleanup: Found ${orphanedTeams.length} remaining teams, cleaning up`);
                for (const t of orphanedTeams) {
                  if (isPostgreSQL) {
                    await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: '=', value: t.id }], tx);
                  } else {
                    await tx.teamPlayer.deleteMany({ where: { teamId: t.id } });
                  }
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.team.deleteMany({ where: { tournamentId: id } });
                }
              }
              const orphanedMatchCount = await tx.match.count({ where: { tournamentId: id } });
              if (orphanedMatchCount > 0) {
                console.warn(`Orphaned data cleanup: Found ${orphanedMatchCount} remaining matches, cleaning up`);
                if (isPostgreSQL) {
                  await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
                  await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
                  await tx.match.deleteMany({ where: { tournamentId: id } });
                }
              }
              // Reset all match-related player points
              if (isPostgreSQL) {
                await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
              } else {
                await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
              }
              // Ensure participations are in correct state for approval/registration
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'assigned' }],
                  { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
                );
                await neonUpdateMany('Participation',
                  [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'approved' }],
                  { pointsEarned: 0, isMvp: false, isWinner: false },
                );
              } else {
                await tx.participation.updateMany({
                  where: { tournamentId: id, status: 'assigned' },
                  data: { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
                });
                // Also reset any participation points from matches
                await tx.participation.updateMany({
                  where: { tournamentId: id, status: 'approved' },
                  data: { pointsEarned: 0, isMvp: false, isWinner: false },
                });
              }
            });
          } catch (cleanupError) {
            console.error('Orphaned data cleanup (before team_generation) error:', cleanupError);
            revertErrors.push(cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error');
          }
        }

        // Target before bracket_generation: No matches should exist (teams OK)
        if (targetIdx < statusOrder.indexOf('bracket_generation')) {
          try {
            // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              const orphanedMatchCount = await tx.match.count({ where: { tournamentId: id } });
              if (orphanedMatchCount > 0) {
                console.warn(`Orphaned data cleanup: Found ${orphanedMatchCount} remaining matches before bracket_generation, cleaning up`);
                if (isPostgreSQL) {
                  await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
                  await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
                  await tx.match.deleteMany({ where: { tournamentId: id } });
                }
              }
            });
          } catch (cleanupError) {
            console.error('Orphaned data cleanup (before bracket_generation) error:', cleanupError);
            revertErrors.push(cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error');
          }
        }

        // Target before main_event: Reset match scores and advancement data
        if (targetIdx < statusOrder.indexOf('main_event')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              // Reset any completed matches back to ready/pending
              const completedCount = await tx.match.count({ where: { tournamentId: id, status: 'completed' } });
              if (completedCount > 0) {
                console.warn(`Orphaned data cleanup: Found ${completedCount} completed matches before main_event, resetting`);
                // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
                if (isPostgreSQL) {
                  await neonUpdateMany('Match',
                    [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'completed' }],
                    { score1: null, score2: null, status: 'pending', winnerId: null, loserId: null, completedAt: null, mvpPlayerId: null },
                  );
                } else {
                  await tx.match.updateMany({
                    where: { tournamentId: id, status: 'completed' },
                    data: { score1: null, score2: null, status: 'pending', winnerId: null, loserId: null, completedAt: null, mvpPlayerId: null },
                  });
                }
                // Re-mark matches with both teams as 'ready'
                const readyMatches = await tx.match.findMany({
                  where: { tournamentId: id, status: 'pending', team1Id: { not: null }, team2Id: { not: null } },
                  select: { id: true },
                });
                for (const m of readyMatches) {
                  await tx.match.update({ where: { id: m.id }, data: { status: 'ready' } });
                }
              }
              // Clear teams from later-round matches (advancements)
              const laterMatches = await tx.match.findMany({
                where: { tournamentId: id, status: 'pending', bracket: { in: ['upper', 'lower', 'grand_final'] } },
                select: { id: true, round: true, bracket: true },
              });
              for (const m of laterMatches) {
                if (m.bracket === 'group') continue;
                if (m.bracket === 'upper' && m.round === 1) continue;
                await tx.match.update({ where: { id: m.id }, data: { team1Id: null, team2Id: null, status: 'pending' } });
              }
            });
          } catch (cleanupError) {
            console.error('Orphaned data cleanup (before main_event) error:', cleanupError);
            revertErrors.push(cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error');
          }
        }

        // Target before finalization: Always clean up prizes/achievements/MVP data
        if (targetIdx < statusOrder.indexOf('finalization')) {
          try {
            // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
            await neonTransaction(async (tx) => {
              const existingPrizes = await tx.tournamentPrize.count({ where: { tournamentId: id } });
              if (existingPrizes > 0) {
                console.warn(`Orphaned data cleanup: Found ${existingPrizes} prizes before finalization, cleaning up`);
                // Rollback prize points before deleting
                const prizePointRecords = await tx.playerPoint.findMany({
                  where: { tournamentId: id, reason: { in: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] } },
                  select: { playerId: true, amount: true },
                });
                const pointsByPlayer = new Map<string, number>();
                for (const pr of prizePointRecords) {
                  pointsByPlayer.set(pr.playerId, (pointsByPlayer.get(pr.playerId) || 0) + pr.amount);
                }
                for (const [playerId, totalPoints] of pointsByPlayer) {
                  // Neon workaround: updateMany() with decrement → raw SQL on PostgreSQL
                  if (isPostgreSQL) {
                    await db.$executeRawUnsafe('UPDATE "Player" SET points = points - $1 WHERE id = $2', totalPoints, playerId);
                  } else {
                    await tx.player.updateMany({ where: { id: playerId }, data: { points: { decrement: totalPoints } } });
                  }
                  await tx.$executeRaw`UPDATE "Player" SET points = MAX(points, 0) WHERE id = ${playerId} AND points < 0`;
                }
                if (isPostgreSQL) {
                  await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] }], tx);
                  await neonDeleteMany('TournamentPrize', [{ column: 'tournamentId', operator: '=', value: id }], tx);
                } else {
                  await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other', 'tier_upgrade_bonus'] } } });
                  await tx.tournamentPrize.deleteMany({ where: { tournamentId: id } });
                }
              }

              // Reset team ranks and isWinner
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Team', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'rank', operator: 'NOT NULL' }], { rank: null, isWinner: false });
                await neonUpdateMany('Team', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'isWinner', operator: '=', value: 'true' }], { isWinner: false });
              } else {
                await tx.team.updateMany({ where: { tournamentId: id, rank: { not: null } }, data: { rank: null, isWinner: false } });
                await tx.team.updateMany({ where: { tournamentId: id, isWinner: true }, data: { isWinner: false } });
              }

              // Reset MVP references
              const mvpParts = await tx.participation.findMany({ where: { tournamentId: id, isMvp: true }, select: { playerId: true } });
              for (const mvp of mvpParts) {
                await tx.player.update({ where: { id: mvp.playerId }, data: { totalMvp: { decrement: 1 } } });
                await tx.$executeRaw`UPDATE "Player" SET "totalMvp" = MAX("totalMvp", 0) WHERE id = ${mvp.playerId} AND "totalMvp" < 0`;
              }
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Participation', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'isMvp', operator: '=', value: 'true' }], { isMvp: false });
                await neonUpdateMany('Participation', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'isWinner', operator: '=', value: 'true' }], { isWinner: false });
              } else {
                await tx.participation.updateMany({ where: { tournamentId: id, isMvp: true }, data: { isMvp: false } });
                await tx.participation.updateMany({ where: { tournamentId: id, isWinner: true }, data: { isWinner: false } });
              }
              if (isPostgreSQL) {
                await neonDeleteMany('PlayerAchievement', [{ column: 'tournamentId', operator: '=', value: id }], tx);
              } else {
                await tx.playerAchievement.deleteMany({ where: { tournamentId: id } });
              }
              // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
              if (isPostgreSQL) {
                await neonUpdateMany('Match', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'mvpPlayerId', operator: 'NOT NULL' }], { mvpPlayerId: null });
              } else {
                await tx.match.updateMany({ where: { tournamentId: id, mvpPlayerId: { not: null } }, data: { mvpPlayerId: null } });
              }

              // Reset finalizedAt/completedAt
              await tx.tournament.update({ where: { id }, data: { finalizedAt: null, completedAt: null } }).catch(() => {});
            });
          } catch (cleanupError) {
            console.error('Orphaned data cleanup (before finalization) error:', cleanupError);
            revertErrors.push(cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error');
          }
        }
      } catch (revertError) {
        console.error('Revert phase error:', revertError);
        revertErrors.push(revertError instanceof Error ? revertError.message : 'Unknown revert error');
      }
      // Always update status even if some cleanup steps failed
      if (revertErrors.length > 0) {
        console.warn('Revert completed with errors:', revertErrors);
      }
      } // closes if (targetIdx < currentIdx)
    } // closes if (currentTournament)
    body._reverted = true; // Flag for final consistency check before status commit
  } // closes if (body._revert && body.status)
  delete body._revert; // Don't store this in DB

  // Handle prizes update
  if (body.prizes && Array.isArray(body.prizes)) {
    // Delete existing prizes
    if (isPostgreSQL) {
      await neonDeleteMany('TournamentPrize', [{ column: 'tournamentId', operator: '=', value: id }]);
    } else {
      await db.tournamentPrize.deleteMany({ where: { tournamentId: id } });
    }

    // Create new prizes with auto-calculated pointsPerPlayer
    for (const prize of body.prizes) {
      const totalPoints = Math.floor(prize.prizeAmount / 1000);
      const pointsPerPlayer = prize.recipientCount > 0
        ? Math.floor(totalPoints / prize.recipientCount)
        : totalPoints;

      await db.tournamentPrize.create({
        data: {
          tournamentId: id,
          label: prize.label,
          position: prize.position || 0,
          prizeAmount: prize.prizeAmount || 0,
          pointsPerPlayer,
          recipientCount: prize.recipientCount || 1,
        },
      });
    }
  }

  // ─── Final update: wrap in transaction for atomicity ───
  // If a revert was performed, verify consistency before committing the status change.
  // This prevents the status from updating if orphaned data remains from a failed revert.
  // Neon workaround: $transaction() + updateMany() don't work with PrismaNeonHttp
  const tournament = await neonTransaction(async (tx) => {
    // If we just reverted, do a quick consistency check on the target status
    if (body._reverted === true && body.status) {
      const statusOrder = ['setup', 'registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization', 'completed'];
      const targetIdx = statusOrder.indexOf(body.status);

      if (targetIdx < statusOrder.indexOf('team_generation')) {
        const orphanedTeams = await tx.team.count({ where: { tournamentId: id } });
        const orphanedMatches = await tx.match.count({ where: { tournamentId: id } });
        if (orphanedTeams > 0 || orphanedMatches > 0) {
          // Attempt cleanup of any remaining orphaned data before status change
          if (orphanedMatches > 0) {
            if (isPostgreSQL) {
              await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
              await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
            } else {
              await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
              await tx.match.deleteMany({ where: { tournamentId: id } });
            }
          }
          if (orphanedTeams > 0) {
            const teams = await tx.team.findMany({ where: { tournamentId: id }, select: { id: true } });
            for (const t of teams) {
              if (isPostgreSQL) {
                await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: '=', value: t.id }], tx);
              } else {
                await tx.teamPlayer.deleteMany({ where: { teamId: t.id } });
              }
            }
            if (isPostgreSQL) {
              await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }], tx);
            } else {
              await tx.team.deleteMany({ where: { tournamentId: id } });
            }
          }
          // Neon workaround: updateMany() → neonUpdateMany on PostgreSQL
          if (isPostgreSQL) {
            await neonUpdateMany('Participation',
              [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'assigned' }],
              { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
            );
          } else {
            await tx.participation.updateMany({
              where: { tournamentId: id, status: 'assigned' },
              data: { status: 'approved', pointsEarned: 0, isMvp: false, isWinner: false },
            });
          }
        }
      } else if (targetIdx < statusOrder.indexOf('bracket_generation')) {
        const orphanedMatches = await tx.match.count({ where: { tournamentId: id } });
        if (orphanedMatches > 0) {
          if (isPostgreSQL) {
            await neonDeleteMany('PlayerPoint', [{ column: 'tournamentId', operator: '=', value: id }, { column: 'reason', operator: 'IN', value: ['participation', 'match_win', 'match_draw', 'streak_bonus'] }], tx);
            await neonDeleteMany('Match', [{ column: 'tournamentId', operator: '=', value: id }], tx);
          } else {
            await tx.playerPoint.deleteMany({ where: { tournamentId: id, reason: { in: ['participation', 'match_win', 'match_draw', 'streak_bonus'] } } });
            await tx.match.deleteMany({ where: { tournamentId: id } });
          }
        }
      }
    }

    return tx.tournament.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.name && { name: body.name }),
        ...(body.weekNumber !== undefined && { weekNumber: body.weekNumber }),
        ...(body.format && { format: body.format }),
        ...(body.defaultMatchFormat && { defaultMatchFormat: body.defaultMatchFormat }),
        ...(body.prizePool !== undefined && { prizePool: body.prizePool }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.bpm !== undefined && { bpm: body.bpm }),
        ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? wibToUTC(body.scheduledAt) : null }),
        ...(body.status === 'completed' && { completedAt: new Date() }),
      },
    });
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'update',
    entity: 'tournament',
    entityId: id,
    details: `Update tournament`,
  });

  // Purge CDN cache so dashboard reflects new status immediately
  revalidateTag('league-data', 'max');

  return NextResponse.json(tournament);
  } catch (error) {
    console.error('Update tournament error:', error);
    return NextResponse.json({ error: 'Failed to update tournament' }, { status: 500 });
  }
}
