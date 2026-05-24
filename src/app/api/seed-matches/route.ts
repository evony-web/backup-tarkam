import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Find current seasons
    const maleSeason = await db.season.findFirst({ where: { division: 'male', status: 'active' } });
    const femaleSeason = await db.season.findFirst({ where: { division: 'female', status: 'active' } });

    if (!maleSeason && !femaleSeason) {
      return NextResponse.json({ error: 'No active seasons found. Run /api/seed first.' }, { status: 400 });
    }

    let matchesCreated = 0;
    let mvpAwardsCreated = 0;

    async function seedMatchesForSeason(
      seasonId: string,
      division: string,
    ) {
      // Get players for this division
      const players = await db.player.findMany({
        where: { division, isActive: true },
      });

      if (players.length < 8) return;

      // Check what week numbers already exist for this season
      const existingTournaments = await db.tournament.findMany({
        where: { seasonId },
        select: { weekNumber: true },
      });
      const existingWeeks = new Set(existingTournaments.map(t => t.weekNumber));

      // Find 2 completed week numbers and 1 upcoming that don't conflict
      let completedWeeks: number[] = [];
      let upcomingWeek = -1;
      for (let w = 1; w <= 20; w++) {
        if (!existingWeeks.has(w)) {
          if (completedWeeks.length < 4) {
            completedWeeks.push(w);
          } else if (upcomingWeek === -1) {
            upcomingWeek = w;
          }
        }
        if (completedWeeks.length >= 4 && upcomingWeek !== -1) break;
      }

      if (completedWeeks.length < 2) return;

      // Take first 2 completed weeks + 1 upcoming
      completedWeeks = completedWeeks.slice(0, 2);

      for (const weekNum of completedWeeks) {
        const daysAgo = (5 - weekNum) * 7; // Older weeks are further back

        const tournament = await db.tournament.create({
          data: {
            name: `IDM League Week ${weekNum} - ${division === 'male' ? 'Cowo' : 'Cewe'}`,
            weekNumber: weekNum,
            division,
            status: 'completed',
            format: 'single_elimination',
            defaultMatchFormat: 'BO3',
            seasonId,
            prizePool: 50000,
            scheduledAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - (daysAgo - 3) * 24 * 60 * 60 * 1000),
          },
        });

        // Create 8 teams with 2 players each
        const shuffled = [...players].sort(() => Math.random() - 0.5).slice(0, 16);
        const teams: { id: string; playerIds: string[] }[] = [];

        for (let i = 0; i < 16; i += 2) {
          const teamPlayers = shuffled.slice(i, i + 2);
          const teamName = `${division === 'male' ? 'M' : 'F'}-W${weekNum}-${String.fromCharCode(65 + teams.length)}`;

          const team = await db.team.create({
            data: {
              name: teamName,
              tournamentId: tournament.id,
              power: teamPlayers.reduce((sum, p) => sum + p.points, 0),
              isWinner: false,
            },
          });

          for (const p of teamPlayers) {
            await db.teamPlayer.create({
              data: { teamId: team.id, playerId: p.id },
            });
          }

          teams.push({ id: team.id, playerIds: teamPlayers.map(p => p.id) });
        }

        // Create 4 completed matches from the 8 teams
        for (let i = 0; i < 8; i += 2) {
          const teamA = teams[i];
          const teamB = teams[i + 1];

          const score1 = Math.floor(Math.random() * 2) + 1;
          const score2 = score1 === 2 ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2) + 1;
          const team1Wins = score1 > score2;
          const winnerId = team1Wins ? teamA.id : teamB.id;
          const loserId = team1Wins ? teamB.id : teamA.id;
          const winnerPlayerIds = team1Wins ? teamA.playerIds : teamB.playerIds;
          const loserPlayerIds = team1Wins ? teamB.playerIds : teamA.playerIds;

          const match = await db.match.create({
            data: {
              tournamentId: tournament.id,
              round: 1,
              matchNumber: i / 2 + 1,
              bracket: 'upper',
              format: 'BO3',
              team1Id: teamA.id,
              team2Id: teamB.id,
              score1,
              score2,
              status: 'completed',
              winnerId,
              loserId,
              completedAt: new Date(Date.now() - (daysAgo - 1) * 24 * 60 * 60 * 1000 + (i / 2) * 3600000),
            },
          });

          matchesCreated++;

          // Assign MVP from winning team
          const mvpPlayerId = winnerPlayerIds[Math.floor(Math.random() * winnerPlayerIds.length)];
          await db.match.update({
            where: { id: match.id },
            data: { mvpPlayerId },
          });
          mvpAwardsCreated++;

          // Update MVP player
          await db.player.update({
            where: { id: mvpPlayerId },
            data: {
              totalMvp: { increment: 1 },
              totalWins: { increment: 1 },
              streak: { increment: 1 },
              maxStreak: { increment: 1 },
              matches: { increment: 1 },
              points: { increment: 30 },
            },
          });

          // Update other winner members
          for (const pid of winnerPlayerIds) {
            if (pid !== mvpPlayerId) {
              await db.player.update({
                where: { id: pid },
                data: {
                  totalWins: { increment: 1 },
                  streak: { increment: 1 },
                  maxStreak: { increment: 1 },
                  matches: { increment: 1 },
                  points: { increment: 20 },
                },
              });
            }
          }

          // Update loser members
          for (const pid of loserPlayerIds) {
            const p = await db.player.findUnique({ where: { id: pid } });
            if (p) {
              await db.player.update({
                where: { id: pid },
                data: {
                  matches: { increment: 1 },
                  streak: 0,
                  points: { increment: 5 },
                },
              });
            }
          }

          // Mark winner team
          await db.team.update({
            where: { id: winnerId },
            data: { isWinner: true },
          });
        }
      }

      // Create upcoming tournament
      if (upcomingWeek !== -1) {
        const tournament = await db.tournament.create({
          data: {
            name: `IDM League Week ${upcomingWeek} - ${division === 'male' ? 'Cowo' : 'Cewe'}`,
            weekNumber: upcomingWeek,
            division,
            status: 'setup',
            format: 'single_elimination',
            defaultMatchFormat: 'BO3',
            seasonId,
            prizePool: 50000,
            scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        });

        const shuffled = [...players].sort(() => Math.random() - 0.5).slice(0, 4);
        const teams: { id: string; playerIds: string[] }[] = [];

        for (let i = 0; i < 4; i += 2) {
          const teamPlayers = shuffled.slice(i, i + 2);
          const teamName = `${division === 'male' ? 'M' : 'F'}-W${upcomingWeek}-${String.fromCharCode(65 + teams.length)}`;

          const team = await db.team.create({
            data: {
              name: teamName,
              tournamentId: tournament.id,
              power: teamPlayers.reduce((sum, p) => sum + p.points, 0),
              isWinner: false,
            },
          });

          for (const p of teamPlayers) {
            await db.teamPlayer.create({
              data: { teamId: team.id, playerId: p.id },
            });
          }

          teams.push({ id: team.id, playerIds: teamPlayers.map(p => p.id) });
        }

        // Create 2 upcoming matches
        for (let i = 0; i + 1 < teams.length; i += 2) {
          await db.match.create({
            data: {
              tournamentId: tournament.id,
              round: 1,
              matchNumber: i / 2 + 1,
              bracket: 'upper',
              format: 'BO3',
              team1Id: teams[i].id,
              team2Id: teams[i + 1].id,
              status: 'upcoming',
              scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            },
          });
          matchesCreated++;
        }
      }
    }

    // Seed for male division
    if (maleSeason) {
      await seedMatchesForSeason(maleSeason.id, 'male');
    }

    // Seed for female division
    if (femaleSeason) {
      await seedMatchesForSeason(femaleSeason.id, 'female');
    }

    // Update player tiers based on points (only active players)
    const allPlayers = await db.player.findMany({ where: { isActive: true }, orderBy: { points: 'desc' } });
    const sTierCutoff = Math.max(3, Math.floor(allPlayers.length * 0.1));
    const aTierCutoff = Math.max(6, Math.floor(allPlayers.length * 0.25));

    for (let i = 0; i < allPlayers.length; i++) {
      let tier = 'B';
      if (i < sTierCutoff) tier = 'S';
      else if (i < aTierCutoff) tier = 'A';

      if (allPlayers[i].tier !== tier) {
        await db.player.update({
          where: { id: allPlayers[i].id },
          data: { tier },
        });
      }
    }

    return NextResponse.json({
      success: true,
      matchesCreated,
      mvpAwardsCreated,
      message: `Created ${matchesCreated} matches with ${mvpAwardsCreated} MVP awards across both divisions`,
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Seed matches error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
