import { db, neonUpdateMany, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';

/** Fisher-Yates shuffle in-place */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        participations: {
          where: { status: 'approved' },
          include: { player: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const totalApproved = tournament.participations.length;

    // VALIDATION: Total must be divisible by 3
    if (totalApproved === 0) {
      return NextResponse.json(
        { error: 'No approved players to form teams' },
        { status: 400 }
      );
    }

    if (totalApproved % 3 !== 0) {
      const remainder = totalApproved % 3;
      const needed = 3 - remainder;
      return NextResponse.json(
        {
          error: `Need ${needed} more player(s) to form complete teams (total must be divisible by 3, current: ${totalApproved})`,
          totalApproved,
          needed,
        },
        { status: 400 }
      );
    }

    // Determine effective tier for each player: tierOverride if set, otherwise player.tier
    type PlayerWithParticipation = typeof tournament.participations[number] & {
      effectiveTier: string;
    };

    const playersWithTier: PlayerWithParticipation[] = tournament.participations.map((p) => ({
      ...p,
      effectiveTier: p.tierOverride || p.player.tier,
    }));

    // Group by effective tier
    const sTier = playersWithTier.filter((p) => p.effectiveTier === 'S');
    const aTier = playersWithTier.filter((p) => p.effectiveTier === 'A');
    const bTier = playersWithTier.filter((p) => p.effectiveTier === 'B');

    const teamCount = totalApproved / 3;

    // Validate tier distribution: each tier must have exactly teamCount players
    if (sTier.length !== teamCount || aTier.length !== teamCount || bTier.length !== teamCount) {
      return NextResponse.json(
        {
          error: `Tier distribution mismatch for ${teamCount} teams. Need ${teamCount} of each tier. Got S:${sTier.length}, A:${aTier.length}, B:${bTier.length}`,
          sCount: sTier.length,
          aCount: aTier.length,
          bCount: bTier.length,
          teamCount,
        },
        { status: 400 }
      );
    }

    // SHUFFLE: Randomize each tier independently using Fisher-Yates
    const shuffledS = fisherYatesShuffle(sTier);
    const shuffledA = fisherYatesShuffle(aTier);
    const shuffledB = fisherYatesShuffle(bTier);

    // Delete existing teams first (regeneration support)
    // Neon HTTP adapter does NOT support deleteMany with complex where — use raw SQL
    const existingTeams = await db.team.findMany({ where: { tournamentId: id } });
    if (existingTeams.length > 0) {
      const teamIds = existingTeams.map((t) => t.id);
      if (isPostgreSQL) {
        // Delete TeamPlayers first (FK constraint), then Teams — using raw SQL
        await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: 'IN', value: teamIds }]);
        await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }]);
      } else {
        await db.teamPlayer.deleteMany({
          where: { teamId: { in: teamIds } },
        });
        await db.team.deleteMany({ where: { tournamentId: id } });
      }
    }

    // Each team gets 1S + 1A + 1B
    // Team naming: named after the S-tier player's gamertag
    const teams: { id: string; name: string; power: number; playerIds: string[] }[] = [];

    for (let i = 0; i < teamCount; i++) {
      const sPlayer = shuffledS[i];
      const aPlayer = shuffledA[i];
      const bPlayer = shuffledB[i];

      // Name team after S-tier player
      const teamName = `Tim ${sPlayer.player.gamertag}`;
      const power = sPlayer.player.points + aPlayer.player.points + bPlayer.player.points;
      const playerIds = [sPlayer.playerId, aPlayer.playerId, bPlayer.playerId];

      const team = await db.team.create({
        data: {
          name: teamName,
          tournamentId: id,
          power,
        },
      });

      // Neon HTTP adapter does NOT support createMany — use individual creates
      if (isPostgreSQL) {
        await db.teamPlayer.create({
          data: { teamId: team.id, playerId: sPlayer.playerId, tier: sPlayer.effectiveTier },
        });
        await db.teamPlayer.create({
          data: { teamId: team.id, playerId: aPlayer.playerId, tier: aPlayer.effectiveTier },
        });
        await db.teamPlayer.create({
          data: { teamId: team.id, playerId: bPlayer.playerId, tier: bPlayer.effectiveTier },
        });
      } else {
        await db.teamPlayer.createMany({
          data: [
            { teamId: team.id, playerId: sPlayer.playerId, tier: sPlayer.effectiveTier },
            { teamId: team.id, playerId: aPlayer.playerId, tier: aPlayer.effectiveTier },
            { teamId: team.id, playerId: bPlayer.playerId, tier: bPlayer.effectiveTier },
          ],
        });
      }

      teams.push({ id: team.id, name: teamName, power, playerIds });
    }

    // Build effective tier lookup from participations (respects tierOverride)
    const participationMap = new Map<string, string>(); // playerId -> effectiveTier
    for (const p of tournament.participations) {
      participationMap.set(p.playerId, p.tierOverride || p.player.tier);
    }
    const getEffectiveTier = (playerId: string): string => {
      return participationMap.get(playerId) || 'B';
    };

    // Auto-balance: After initial assignment, try swapping B-tier players between teams if power imbalance > 15%
    if (teams.length >= 2) {
      let improved = true;
      let iterations = 0;
      const maxIterations = teams.length * teams.length;

      while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        const teamsWithPlayers = await db.team.findMany({
          where: { tournamentId: id },
          include: { teamPlayers: { include: { player: true } } },
        });

        const powers = teamsWithPlayers.map((t) => t.power);
        const maxPower = Math.max(...powers);
        const minPower = Math.min(...powers);

        if (maxPower > 0 && (maxPower - minPower) / maxPower > 0.15) {
          const sorted = [...teamsWithPlayers].sort((a, b) => b.power - a.power);
          const strongest = sorted[0];
          const weakest = sorted[sorted.length - 1];

          const bPlayerStrongest = strongest.teamPlayers.find(
            (tp) => tp.tier === 'B'
          );
          const bPlayerWeakest = weakest.teamPlayers.find(
            (tp) => tp.tier === 'B'
          );

          if (bPlayerStrongest && bPlayerWeakest) {
            const newStrongestPower =
              strongest.power - bPlayerStrongest.player.points + bPlayerWeakest.player.points;
            const newWeakestPower =
              weakest.power - bPlayerWeakest.player.points + bPlayerStrongest.player.points;

            const currentImbalance = maxPower - minPower;
            const newMaxPower = Math.max(newStrongestPower, newWeakestPower);
            const newMinPower = Math.min(newStrongestPower, newWeakestPower);
            const newImbalance = newMaxPower - newMinPower;

            if (newImbalance < currentImbalance) {
              // Swap B-tier player assignments (keep tier field as 'B' since only B-tier players swap)
              await db.teamPlayer.update({
                where: { id: bPlayerStrongest.id },
                data: { playerId: bPlayerWeakest.playerId },
              });
              await db.teamPlayer.update({
                where: { id: bPlayerWeakest.id },
                data: { playerId: bPlayerStrongest.playerId },
              });

              await db.team.update({
                where: { id: strongest.id },
                data: { power: newStrongestPower },
              });
              await db.team.update({
                where: { id: weakest.id },
                data: { power: newWeakestPower },
              });

              improved = true;
            }
          }
        }
      }

      // After auto-balance swaps, update team names to reflect current S-tier player
      const finalTeamsWithPlayers = await db.team.findMany({
        where: { tournamentId: id },
        include: { teamPlayers: { include: { player: true } } },
      });

      for (const team of finalTeamsWithPlayers) {
        const sPlayer = team.teamPlayers.find(tp => tp.tier === 'S');
        if (sPlayer) {
          const correctName = `Tim ${sPlayer.player.gamertag}`;
          if (team.name !== correctName) {
            await db.team.update({
              where: { id: team.id },
              data: { name: correctName },
            });
          }
        }
      }
    }

    // Update tournament status
    await db.tournament.update({
      where: { id },
      data: { status: 'team_generation' },
    });

    // Update participation statuses to "assigned"
    // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
    if (isPostgreSQL) {
      await neonUpdateMany('Participation',
        [{ column: 'tournamentId', operator: '=', value: id }, { column: 'status', operator: '=', value: 'approved' }],
        { status: 'assigned' },
      );
    } else {
      await db.participation.updateMany({
        where: { tournamentId: id, status: 'approved' },
        data: { status: 'assigned' },
      });
    }

    const finalTeams = await db.team.findMany({
      where: { tournamentId: id },
      include: { teamPlayers: { include: { player: true } } },
      orderBy: { name: 'asc' },
    });

    // Build spin reveal data from FINAL teams (after auto-balance swaps)
    const spinRevealOrder: {
      teamIndex: number;
      teamName: string;
      tier: string;
      player: { id: string; gamertag: string; tier: string; points: number };
      allPlayersInTier: { id: string; gamertag: string; tier: string; points: number }[];
    }[] = [];

    const teamIndexMap = new Map<string, number>();
    finalTeams.forEach((team, idx) => {
      teamIndexMap.set(team.id, idx);
    });

    // Collect all players per tier from final teams (with correct team assignments)
    for (const tier of ['S', 'A', 'B'] as const) {
      const allTierPlayers: { id: string; gamertag: string; tier: string; points: number }[] = [];
      for (const team of finalTeams) {
        const tp = team.teamPlayers.find(p => p.tier === tier);
        if (tp) {
          allTierPlayers.push({
            id: tp.player.id,
            gamertag: tp.player.gamertag,
            tier,
            points: tp.player.points,
          });
        }
      }

      for (const team of finalTeams) {
        const teamIdx = teamIndexMap.get(team.id) ?? 0;
        const tierPlayer = team.teamPlayers.find(p => p.tier === tier);
        if (!tierPlayer) continue;

        spinRevealOrder.push({
          teamIndex: teamIdx,
          teamName: team.name,
          tier,
          player: {
            id: tierPlayer.player.id,
            gamertag: tierPlayer.player.gamertag,
            tier,
            points: tierPlayer.player.points,
          },
          allPlayersInTier: allTierPlayers,
        });
      }
    }

    // Pusher: Notify real-time clients about team generation
    void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_STATUS_CHANGED, {
      tournamentId: id, division: tournament.division, teamCount, status: 'team_generation',
    });
    void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
      type: 'teams-generated', tournamentId: id, division: tournament.division, teamCount,
    });

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'create',
      entity: 'tournament',
      entityId: id,
      details: 'Generate tim',
      metadata: { tournamentId: id, teamCount },
    });

    return NextResponse.json({ teams: finalTeams, teamCount, spinRevealOrder });
  } catch (error) {
    console.error('[generate-teams] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
