/**
 * Reset Week 2 Female Tournament Data
 * 
 * This script resets ALL points, W/L status, winrate, and related stats
 * for the female/cewe week 2 tournament. Only week 1 data is preserved.
 * 
 * What it does:
 * 1. Rollback ALL PlayerPoint records for week 2 female tournament
 * 2. Rollback player stats (totalWins, matches, streak, maxStreak)
 * 3. Rollback club stats (wins, losses, points, gameDiff)
 * 4. Delete Match records for week 2
 * 5. Delete Team/TeamPlayer records for week 2
 * 6. Reset Participation records for week 2
 * 7. Delete TournamentPrize, PlayerAchievement, Donation records
 * 8. Update tournament status to 'bracket_generation'
 * 9. Recalculate player stats from remaining data (week 1 only)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const TOURNAMENT_ID = 'cmp9qtdns0001jm04gkhkfdrp'; // Week 2 Female tournament

async function resetWeek2Female() {
  console.log('=== RESET WEEK 2 FEMALE TOURNAMENT DATA ===\n');

  // Step 0: Verify tournament exists
  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    select: { id: true, weekNumber: true, division: true, status: true, seasonId: true },
  });

  if (!tournament) {
    console.error('ERROR: Week 2 female tournament not found!');
    process.exit(1);
  }

  console.log(`Tournament: Week ${tournament.weekNumber}, Division: ${tournament.division}, Status: ${tournament.status}`);
  console.log(`Season ID: ${tournament.seasonId}\n`);

  // ─── Step 1: Get ALL PlayerPoint records for this tournament ───
  console.log('Step 1: Rolling back player points...');
  const allPointRecords = await prisma.playerPoint.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true, playerId: true, amount: true, reason: true },
  });

  console.log(`  Found ${allPointRecords.length} PlayerPoint records`);

  // Group by player and sum amounts to deduct
  const pointsByPlayer = new Map<string, number>();
  for (const pr of allPointRecords) {
    pointsByPlayer.set(pr.playerId, (pointsByPlayer.get(pr.playerId) || 0) + pr.amount);
  }

  console.log(`  Affecting ${pointsByPlayer.size} players`);
  for (const [playerId, totalPoints] of pointsByPlayer) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, points: true } });
    console.log(`  - ${player?.name || playerId}: deduct ${totalPoints} pts (current: ${player?.points})`);
    await prisma.player.update({
      where: { id: playerId },
      data: { points: { decrement: totalPoints } },
    });
    // Clamp to 0
    await prisma.$executeRaw`UPDATE "Player" SET points = MAX(points, 0) WHERE id = ${playerId} AND points < 0`;
  }

  // Delete all player points for this tournament
  const deletedPoints = await prisma.playerPoint.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  console.log(`  Deleted ${deletedPoints.count} PlayerPoint records\n`);

  // ─── Step 2: Get completed matches and rollback player stats ───
  console.log('Step 2: Rolling back player W/L/matches stats...');
  const completedMatches = await prisma.match.findMany({
    where: { tournamentId: TOURNAMENT_ID, status: 'completed' },
    select: {
      id: true,
      team1Id: true,
      team2Id: true,
      winnerId: true,
      loserId: true,
      team1: { select: { id: true, teamPlayers: { select: { playerId: true } } } },
      team2: { select: { id: true, teamPlayers: { select: { playerId: true } } } },
    },
  });

  console.log(`  Found ${completedMatches.length} completed matches`);

  // Calculate stat deltas per player
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

  // Apply player stat changes
  for (const [playerId, changes] of playerStatChanges) {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, totalWins: true, matches: true } });
    console.log(`  - ${player?.name || playerId}: winsDelta=${changes.winsDelta}, matchesDelta=${changes.matchesDelta} (current: W=${player?.totalWins}, M=${player?.matches})`);
    await prisma.player.update({
      where: { id: playerId },
      data: {
        ...(changes.winsDelta !== 0 && { totalWins: { increment: changes.winsDelta } }),
        ...(changes.matchesDelta !== 0 && { matches: { increment: changes.matchesDelta } }),
        streak: 0,
      },
    });
    await prisma.$executeRaw`UPDATE "Player" SET "totalWins" = MAX("totalWins", 0), matches = MAX(matches, 0) WHERE id = ${playerId} AND ("totalWins" < 0 OR matches < 0)`;
  }
  console.log('');

  // ─── Step 3: Rollback club stats ───
  console.log('Step 3: Rolling back club stats...');
  const clubStatChanges = new Map<string, { winsDelta: number; lossesDelta: number; pointsDelta: number; gameDiffDelta: number }>();

  for (const match of completedMatches) {
    if (!match.team1 || !match.team2 || !match.winnerId) continue;
    const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
    const losingTeam = match.loserId
      ? (match.team1Id === match.loserId ? match.team1 : match.team2)
      : (match.team1Id === match.winnerId ? match.team2 : match.team1);
    if (!losingTeam) continue;

    const gameDiff = 1; // For Swiss format, game diff is typically 1 per win/loss

    const allPlayerIds = [
      ...winningTeam.teamPlayers.map(tp => tp.playerId),
      ...losingTeam.teamPlayers.map(tp => tp.playerId),
    ];

    const memberships = await prisma.clubMember.findMany({
      where: {
        playerId: { in: allPlayerIds },
        leftAt: null,
        profile: { seasonEntries: { some: { division: 'female', seasonId: tournament.seasonId } } },
      },
      include: { profile: { include: { seasonEntries: { where: { division: 'female', seasonId: tournament.seasonId } } } } },
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

  for (const [clubId, changes] of clubStatChanges) {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { wins: true, losses: true, points: true, gameDiff: true } });
    console.log(`  - Club ${clubId}: winsDelta=${changes.winsDelta}, lossesDelta=${changes.lossesDelta}, pointsDelta=${changes.pointsDelta} (current: W=${club?.wins}, L=${club?.losses}, P=${club?.points})`);
    await prisma.club.update({
      where: { id: clubId },
      data: {
        ...(changes.winsDelta !== 0 && { wins: { increment: changes.winsDelta } }),
        ...(changes.lossesDelta !== 0 && { losses: { increment: changes.lossesDelta } }),
        ...(changes.pointsDelta !== 0 && { points: { increment: changes.pointsDelta } }),
        ...(changes.gameDiffDelta !== 0 && { gameDiff: { increment: changes.gameDiffDelta } }),
      },
    });
    // Clamp to 0
    await prisma.$executeRaw`UPDATE "Club" SET wins = MAX(wins, 0), losses = MAX(losses, 0), points = MAX(points, 0) WHERE id = ${clubId} AND (wins < 0 OR losses < 0 OR points < 0)`;
  }
  console.log('');

  // ─── Step 4: Delete matches ───
  console.log('Step 4: Deleting matches...');
  const deletedMatches = await prisma.match.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  console.log(`  Deleted ${deletedMatches.count} matches\n`);

  // ─── Step 5: Delete team players and teams ───
  console.log('Step 5: Deleting teams...');
  const teams = await prisma.team.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true },
  });
  for (const team of teams) {
    await prisma.teamPlayer.deleteMany({ where: { teamId: team.id } });
  }
  const deletedTeams = await prisma.team.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  console.log(`  Deleted ${deletedTeams.count} teams\n`);

  // ─── Step 6: Reset participations ───
  console.log('Step 6: Resetting participations...');
  const resetParts = await prisma.participation.updateMany({
    where: { tournamentId: TOURNAMENT_ID },
    data: { pointsEarned: 0, isMvp: false, isWinner: false, status: 'approved' },
  });
  console.log(`  Reset ${resetParts.count} participations\n`);

  // ─── Step 7: Delete tournament prizes, achievements, donations, sponsors ───
  console.log('Step 7: Deleting tournament prizes, achievements, donations...');
  const delPrizes = await prisma.tournamentPrize.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  const delAchievements = await prisma.playerAchievement.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  const delDonations = await prisma.donation.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  const delSponsors = await prisma.tournamentSponsor.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  const delSponsoredPrizes = await prisma.sponsoredPrize.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  console.log(`  Deleted: ${delPrizes.count} prizes, ${delAchievements.count} achievements, ${delDonations.count} donations, ${delSponsors.count} sponsors, ${delSponsoredPrizes.count} sponsored prizes\n`);

  // ─── Step 8: Update tournament status ───
  console.log('Step 8: Updating tournament status to bracket_generation...');
  await prisma.tournament.update({
    where: { id: TOURNAMENT_ID },
    data: {
      status: 'bracket_generation',
      finalizedAt: null,
      completedAt: null,
    },
  });
  console.log('  Tournament status updated to bracket_generation\n');

  // ─── Step 9: Recalculate maxStreak from remaining match history (week 1 only) ───
  console.log('Step 9: Recalculating streaks from remaining data...');
  const femalePlayers = await prisma.player.findMany({
    where: { division: 'female' },
    select: { id: true, name: true },
  });

  for (const player of femalePlayers) {
    // Get all remaining match point records (match_win) for this player chronologically
    const matchWins = await prisma.playerPoint.findMany({
      where: {
        playerId: player.id,
        reason: 'match_win',
      },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, createdAt: true, tournamentId: true },
    });

    let currentStreak = 0;
    let maxStreak = 0;
    for (const win of matchWins) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: {
        streak: currentStreak,
        maxStreak: maxStreak,
      },
    });
    console.log(`  - ${player.name}: streak=${currentStreak}, maxStreak=${maxStreak}`);
  }
  console.log('');

  // ─── Step 10: Verify results ───
  console.log('=== VERIFICATION ===\n');

  const updatedPlayers = await prisma.player.findMany({
    where: { division: 'female' },
    select: { id: true, name: true, points: true, totalWins: true, matches: true, streak: true, maxStreak: true },
  });

  console.log('Female Players Stats After Reset:');
  for (const p of updatedPlayers) {
    console.log(`  ${p.name}: pts=${p.points}, W=${p.totalWins}, M=${p.matches}, streak=${p.streak}, maxStreak=${p.maxStreak}`);
  }

  const updatedTournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    select: { status: true, weekNumber: true, division: true },
  });
  console.log(`\nTournament Status: ${updatedTournament?.status}`);
  console.log(`Matches remaining: ${await prisma.match.count({ where: { tournamentId: TOURNAMENT_ID } })}`);
  console.log(`Teams remaining: ${await prisma.team.count({ where: { tournamentId: TOURNAMENT_ID } })}`);
  console.log(`PlayerPoints remaining: ${await prisma.playerPoint.count({ where: { tournamentId: TOURNAMENT_ID } })}`);

  console.log('\n=== RESET COMPLETE ===');
}

resetWeek2Female()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
