// Script to clean up double-counted PlayerPoint records for female tournament
// and reset Player.points for affected players
// Uses Neon HTTP adapter compatible operations (no transactions, no updateMany)

import { db } from '../src/lib/db';

const TOURNAMENT_ID = 'cmp56z7yc0001ky044vldr31x';

async function main() {
  console.log('=== Female Tournament Point Cleanup ===\n');

  // 1. Find all PlayerPoint records for this tournament
  const allPoints = await db.playerPoint.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true, playerId: true, amount: true, reason: true, description: true },
  });

  console.log(`Total PlayerPoint records for tournament: ${allPoints.length}`);

  // Group by reason to show what's there
  const byReason: Record<string, { count: number; totalAmount: number }> = {};
  for (const p of allPoints) {
    if (!byReason[p.reason]) byReason[p.reason] = { count: 0, totalAmount: 0 };
    byReason[p.reason].count++;
    byReason[p.reason].totalAmount += p.amount;
  }
  console.log('\nCurrent PlayerPoint records by reason:');
  for (const [reason, data] of Object.entries(byReason)) {
    console.log(`  ${reason}: ${data.count} records, total ${data.totalAmount} pts`);
  }

  // 2. Get all participations for this tournament (to find all affected players)
  const participations = await db.participation.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true, playerId: true },
  });
  const playerIds = [...new Set(participations.map(p => p.playerId))];
  console.log(`\nAffected players: ${playerIds.length}`);

  // Show current Player.points for each
  const players = await db.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, gamertag: true, points: true, totalWins: true, totalMvp: true, streak: true, maxStreak: true, matches: true },
  });

  console.log('\nCurrent Player.points:');
  for (const p of players) {
    console.log(`  ${p.gamertag}: ${p.points} pts (${p.totalWins}W, ${p.matches}M, streak:${p.streak}, mvp:${p.totalMvp})`);
  }

  // 3. Delete ALL PlayerPoint records for this tournament
  console.log('\nDeleting all PlayerPoint records for this tournament...');
  const deleteResult = await db.playerPoint.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  console.log(`Deleted: ${deleteResult.count} records`);

  // 4. Reset Player stats for affected players
  console.log('\nResetting player stats...');

  for (const player of players) {
    // Check if player has remaining PlayerPoint records from other tournaments
    const otherPoints = await db.playerPoint.findMany({
      where: { playerId: player.id },
      select: { amount: true, reason: true },
    });

    const recalculatedPoints = otherPoints.reduce((sum, p) => sum + p.amount, 0);

    // If no other tournament data, reset to 0
    if (otherPoints.length === 0) {
      await db.player.update({
        where: { id: player.id },
        data: {
          points: 0,
          totalWins: 0,
          totalMvp: 0,
          streak: 0,
          maxStreak: 0,
          matches: 0,
        },
      });
      console.log(`  ${player.gamertag}: RESET to 0`);
    } else {
      // Has points from other tournaments — only adjust points
      await db.player.update({
        where: { id: player.id },
        data: { points: recalculatedPoints },
      });
      console.log(`  ${player.gamertag}: adjusted to ${recalculatedPoints} pts (has other tournament data)`);
    }
  }

  // 5. Reset Participation records (individual updates, no updateMany)
  console.log('\nResetting Participation records...');
  for (const part of participations) {
    await db.participation.update({
      where: { id: part.id },
      data: {
        pointsEarned: 0,
        isWinner: false,
        isMvp: false,
      },
    });
  }
  console.log(`Reset ${participations.length} participations`);

  // 6. Reset Team ranks (individual updates)
  console.log('\nResetting Team ranks...');
  const teams = await db.team.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true },
  });
  for (const team of teams) {
    await db.team.update({
      where: { id: team.id },
      data: {
        rank: null,
        isWinner: false,
      },
    });
  }
  console.log(`Reset ${teams.length} teams`);

  // 7. Verify
  console.log('\n=== Verification ===');
  const verifyPlayers = await db.player.findMany({
    where: { id: { in: playerIds } },
    select: { gamertag: true, points: true, totalWins: true, totalMvp: true, matches: true, streak: true, maxStreak: true },
  });
  for (const p of verifyPlayers) {
    console.log(`  ${p.gamertag}: ${p.points} pts, ${p.totalWins}W/${p.matches}M, streak:${p.streak}, maxStreak:${p.maxStreak}, mvp:${p.totalMvp}`);
  }

  // Verify no PlayerPoint records remain
  const remaining = await db.playerPoint.count({
    where: { tournamentId: TOURNAMENT_ID },
  });
  console.log(`\nRemaining PlayerPoint records: ${remaining}`);

  console.log('\n✅ Cleanup complete! Tournament is at "finalization" status. Admin can re-finalize.');

  await db.$disconnect();
}

main().catch(console.error);
