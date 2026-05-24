// Fix match count for female players with 0 wins but have match records
import { db } from '../src/lib/db';

const TOURNAMENT_ID = 'cmp56z7yc0001ky044vldr31x';

async function main() {
  // Find all completed matches in the female tournament
  const matches = await db.match.findMany({
    where: { tournamentId: TOURNAMENT_ID, status: 'completed' },
    select: {
      id: true,
      team1Id: true,
      team2Id: true,
      winnerId: true,
      team1: { select: { teamPlayers: { select: { playerId: true } } } },
      team2: { select: { teamPlayers: { select: { playerId: true } } } },
    },
  });

  console.log(`Found ${matches.length} completed matches`);

  // Count matches per player
  const playerStats = new Map<string, { matches: number; wins: number }>();

  for (const match of matches) {
    if (!match.team1 || !match.team2) continue;

    const allPlayerIds = [
      ...match.team1.teamPlayers.map(tp => tp.playerId),
      ...match.team2.teamPlayers.map(tp => tp.playerId),
    ];

    const winningTeamIds = match.winnerId === match.team1Id
      ? match.team1.teamPlayers.map(tp => tp.playerId)
      : match.team2.teamPlayers.map(tp => tp.playerId);

    for (const pid of allPlayerIds) {
      const stats = playerStats.get(pid) || { matches: 0, wins: 0 };
      stats.matches++;
      if (winningTeamIds.includes(pid)) stats.wins++;
      playerStats.set(pid, stats);
    }
  }

  // Update players with correct match counts
  for (const [playerId, stats] of playerStats) {
    const player = await db.player.findUnique({
      where: { id: playerId },
      select: { gamertag: true, matches: true, totalWins: true },
    });
    if (!player) continue;

    if (player.matches !== stats.matches || player.totalWins !== stats.wins) {
      await db.player.update({
        where: { id: playerId },
        data: {
          matches: stats.matches,
          totalWins: stats.wins,
        },
      });
      console.log(`${player.gamertag}: matches ${player.matches}→${stats.matches}, wins ${player.totalWins}→${stats.wins}`);
    } else {
      console.log(`${player.gamertag}: OK (matches=${stats.matches}, wins=${stats.wins})`);
    }
  }

  await db.$disconnect();
}

main().catch(console.error);
