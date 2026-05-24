/**
 * Recalculate Player totalWins and matches from actual match records.
 * 
 * Problem: After tournament rollbacks, the denormalized Player counters
 * (totalWins, matches) can drift from reality because rollback logic
 * doesn't always perfectly sync these counters.
 * 
 * This script counts from actual Match + TeamPlayer records to get
 * the true W/L for every player, then updates the Player records.
 * 
 * Run: bun run scripts/recalc-player-stats.ts
 */
import { db } from '../src/lib/db';

async function main() {
  console.log('🔍 Recalculating player stats from actual match records...\n');

  // 1. Get all players
  const players = await db.player.findMany({
    select: { id: true, gamertag: true, totalWins: true, matches: true, totalMvp: true },
  });
  console.log(`Found ${players.length} players\n`);

  // 2. Get all team player memberships
  const teamPlayers = await db.teamPlayer.findMany({
    select: { playerId: true, teamId: true },
  });
  const playerTeamIds = new Map<string, Set<string>>();
  for (const tp of teamPlayers) {
    if (!playerTeamIds.has(tp.playerId)) playerTeamIds.set(tp.playerId, new Set());
    playerTeamIds.get(tp.playerId)!.add(tp.teamId);
  }

  // 3. Get all completed matches with winner/loser info
  // Only count matches from tournaments that are in main_event or later status
  // (excludes rolled-back tournaments that are back to bracket_generation, etc.)
  const matches = await db.match.findMany({
    where: { 
      status: 'completed',
      team2Id: { not: null }, // Exclude BYE matches
      tournament: { status: { in: ['main_event', 'finalization', 'completed'] } },
    },
    select: {
      id: true,
      team1Id: true,
      team2Id: true,
      winnerId: true,
      loserId: true,
      mvpPlayerId: true,
      team1: { select: { teamPlayers: { select: { playerId: true } } } },
      team2: { select: { teamPlayers: { select: { playerId: true } } } },
    },
  });
  console.log(`Found ${matches.length} completed matches\n`);

  // 4. Count actual wins, losses, MVPs per player
  const statsMap = new Map<string, { wins: number; losses: number; mvpCount: number }>();
  
  for (const match of matches) {
    if (!match.winnerId || !match.team1 || !match.team2) continue;

    const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
    const losingTeam = match.loserId
      ? (match.team1Id === match.loserId ? match.team1 : match.team2)
      : (match.team1Id === match.winnerId ? match.team2 : match.team1);

    if (!losingTeam) continue;

    // Winning team players: +1 win, +1 match
    for (const tp of winningTeam.teamPlayers) {
      const stats = statsMap.get(tp.playerId) || { wins: 0, losses: 0, mvpCount: 0 };
      stats.wins++;
      stats.losses++; // total matches = wins + losses
      statsMap.set(tp.playerId, stats);
    }

    // Losing team players: +0 win, +1 match (counted as loss)
    for (const tp of losingTeam.teamPlayers) {
      const stats = statsMap.get(tp.playerId) || { wins: 0, losses: 0, mvpCount: 0 };
      stats.losses++;
      statsMap.set(tp.playerId, stats);
    }

    // MVP count
    if (match.mvpPlayerId) {
      const stats = statsMap.get(match.mvpPlayerId) || { wins: 0, losses: 0, mvpCount: 0 };
      stats.mvpCount++;
      statsMap.set(match.mvpPlayerId, stats);
    }
  }

  // 5. Also count MVP from participation records (tournament-level MVP)
  const mvpParticipations = await db.participation.findMany({
    where: { isMvp: true },
    select: { playerId: true },
  });
  // Merge MVP counts - use the higher of match-level MVP or participation-level MVP
  const participationMvpCount = new Map<string, number>();
  for (const p of mvpParticipations) {
    participationMvpCount.set(p.playerId, (participationMvpCount.get(p.playerId) || 0) + 1);
  }

  // 6. Compare and update
  let fixed = 0;
  let unchanged = 0;

  for (const player of players) {
    const actualStats = statsMap.get(player.id);
    const actualWins = actualStats?.wins ?? 0;
    const actualMatches = actualStats?.losses ?? 0; // In our counting, "losses" = total matches
    const actualMatchMvp = actualStats?.mvpCount ?? 0;
    const actualMvp = Math.max(actualMatchMvp, participationMvpCount.get(player.id) ?? player.totalMvp);

    if (actualWins !== player.totalWins || actualMatches !== player.matches || actualMvp !== player.totalMvp) {
      console.log(`⚠️  ${player.gamertag}: totalWins ${player.totalWins}→${actualWins}, matches ${player.matches}→${actualMatches}, mvp ${player.totalMvp}→${actualMvp}`);
      
      await db.player.update({
        where: { id: player.id },
        data: {
          totalWins: actualWins,
          matches: actualMatches,
          totalMvp: actualMvp,
        },
      });
      fixed++;
    } else {
      unchanged++;
    }
  }

  console.log(`\n✅ Done! Fixed: ${fixed}, Unchanged: ${unchanged}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
