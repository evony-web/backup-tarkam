// Check current state of female tournament data
import { db } from '../src/lib/db';

const TOURNAMENT_ID = 'cmp56z7yc0001ky044vldr31x';

async function main() {
  console.log('=== Female Tournament State Check ===\n');

  // 1. Tournament info
  const tournament = await db.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    select: { id: true, name: true, status: true, format: true, weekNumber: true, division: true },
  });
  console.log('Tournament:', tournament);

  // 2. All matches for this tournament
  const matches = await db.match.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: {
      id: true,
      round: true,
      matchNumber: true,
      bracket: true,
      groupLabel: true,
      format: true,
      team1Id: true,
      team2Id: true,
      score1: true,
      score2: true,
      status: true,
      winnerId: true,
      loserId: true,
      mvpPlayerId: true,
      completedAt: true,
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });

  console.log(`\nMatches: ${matches.length}`);
  for (const m of matches) {
    console.log(`  R${m.round}M${m.matchNumber} [${m.bracket}] ${m.groupLabel || '-'} | Team1:${m.team1Id?.slice(-6) || 'TBD'} vs Team2:${m.team2Id?.slice(-6) || 'TBD'} | Score: ${m.score1}-${m.score2} | Winner:${m.winnerId?.slice(-6) || '-'} Loser:${m.loserId?.slice(-6) || '-'} MVP:${m.mvpPlayerId?.slice(-6) || '-'} | ${m.status}`);
  }

  // 3. Teams with players
  const teams = await db.team.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: {
      id: true,
      name: true,
      rank: true,
      isWinner: true,
      teamPlayers: {
        select: {
          playerId: true,
          tier: true,
          player: { select: { gamertag: true, points: true, totalWins: true, matches: true, streak: true, maxStreak: true } },
        },
      },
    },
  });

  console.log(`\nTeams: ${teams.length}`);
  for (const t of teams) {
    console.log(`  ${t.name} (rank:${t.rank}, winner:${t.isWinner})`);
    for (const tp of t.teamPlayers) {
      console.log(`    ${tp.player.gamertag} [${tp.tier}]: ${tp.player.points}pts, ${tp.player.totalWins}W/${tp.player.matches}M, streak:${tp.player.streak}, maxStreak:${tp.player.maxStreak}`);
    }
  }

  // 4. Remaining PlayerPoint records
  const remainingPoints = await db.playerPoint.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true, playerId: true, amount: true, reason: true, description: true, matchId: true },
  });
  console.log(`\nRemaining PlayerPoint records: ${remainingPoints.length}`);
  for (const p of remainingPoints) {
    console.log(`  ${p.id.slice(-6)} player:${p.playerId.slice(-6)} amt:${p.amount} reason:${p.reason} desc:${p.description}`);
  }

  // 5. Participation records
  const participations = await db.participation.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: {
      id: true,
      playerId: true,
      player: { select: { gamertag: true } },
      pointsEarned: true,
      isWinner: true,
      isMvp: true,
    },
  });
  console.log(`\nParticipations: ${participations.length}`);
  for (const p of participations) {
    console.log(`  ${p.player.gamertag}: pointsEarned:${p.pointsEarned}, isWinner:${p.isWinner}, isMvp:${p.isMvp}`);
  }

  await db.$disconnect();
}

main().catch(console.error);
