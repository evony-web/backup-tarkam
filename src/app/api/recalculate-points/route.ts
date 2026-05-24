import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

/**
 * POST /api/recalculate-points
 * 
 * Recalculates ALL player points using the NEW point system:
 * - Match Win: +1 pt per win (ALL formats)
 * - Streak Bonus: +2 pts per 3 consecutive wins (ALL formats)
 * - Prize Juara: points from TournamentPrize (unchanged)
 * 
 * This will:
 * 1. Delete old match_win, streak_bonus, match_draw, achievement_bonus PlayerPoint records
 * 2. Replay match history in chronological order to calculate new match_win and streak_bonus
 * 3. Keep prize_juara1/2/3, prize_mvp, prize_other records as-is
 * 4. Update Player.points to the new total
 * 5. Update Player.streak and Player.maxStreak based on match history
 */
export async function POST(request: Request) {
  // Auth check — allow secret key for CLI execution or admin session
  const url = new URL(request.url);
  const secretKey = url.searchParams.get('key') || request.headers.get('x-recalculate-key');
  if (secretKey !== process.env.SESSION_SECRET) {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;
  }

  try {
    const results: {
      playerId: string;
      gamertag: string;
      oldPoints: number;
      newPoints: number;
      breakdown: { matchWin: number; streakBonus: number; prize: number; total: number };
    }[] = [];

    // Get all players with points > 0 or matches > 0
    const players = await db.player.findMany({
      where: {
        OR: [
          { points: { gt: 0 } },
          { matches: { gt: 0 } },
        ],
      },
      include: {
        pointRecords: true,
      },
    });

    for (const player of players) {
      // ===== STEP 1: Keep prize points =====
      const prizeReasons = ['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other'];
      const prizeRecords = player.pointRecords.filter(r => prizeReasons.includes(r.reason));
      const prizeTotal = prizeRecords.reduce((sum, r) => sum + r.amount, 0);

      // ===== STEP 2: Get match history from Match records =====
      // Find all teams the player has been on
      const teamPlayers = await db.teamPlayer.findMany({
        where: { playerId: player.id },
        select: { teamId: true },
      });
      const playerTeamIds = teamPlayers.map(tp => tp.teamId);

      // Find all completed matches where the player's team participated
      // We need matches ordered chronologically to calculate streak correctly
      const matches = await db.match.findMany({
        where: {
          status: 'completed',
          OR: [
            { team1Id: { in: playerTeamIds } },
            { team2Id: { in: playerTeamIds } },
          ],
        },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              weekNumber: true,
              createdAt: true,
              format: true,
              seasonId: true,
            },
          },
        },
        orderBy: [
          { tournament: { createdAt: 'asc' } },
          { round: 'asc' },
          { matchNumber: 'asc' },
        ],
      });

      // ===== STEP 3: Calculate match_win and streak_bonus from match results =====
      let matchWinPoints = 0;
      let streakBonusPoints = 0;
      let currentStreak = 0;
      let maxStreak = 0;
      let totalMatchWins = 0;
      let totalMatchCount = 0;

      for (const match of matches) {
        if (!match.winnerId) continue; // Skip draws or incomplete
        
        const isOnTeam1 = playerTeamIds.includes(match.team1Id || '');
        const isOnTeam2 = playerTeamIds.includes(match.team2Id || '');
        if (!isOnTeam1 && !isOnTeam2) continue;

        totalMatchCount++;
        
        const playerTeamWon = match.winnerId && playerTeamIds.includes(match.winnerId);
        
        if (playerTeamWon) {
          // Win: +1 pt
          const oldStreakBonus = Math.floor(currentStreak / 3) * 2;
          currentStreak++;
          const newStreakBonus = Math.floor(currentStreak / 3) * 2;
          const incrementalStreakBonus = newStreakBonus - oldStreakBonus;

          matchWinPoints += 1;
          streakBonusPoints += incrementalStreakBonus;
          totalMatchWins++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          // Loss: streak resets
          currentStreak = 0;
        }
      }

      // ===== STEP 4: Delete old non-prize PlayerPoint records =====
      const nonPrizeReasons = ['match_win', 'streak_bonus', 'match_draw', 'achievement_bonus', 'achievement_reward'];
      const nonPrizeRecordIds = player.pointRecords
        .filter(r => nonPrizeReasons.includes(r.reason))
        .map(r => r.id);

      if (nonPrizeRecordIds.length > 0) {
        await db.playerPoint.deleteMany({
          where: { id: { in: nonPrizeRecordIds } },
        });
      }

      // ===== STEP 5: Create new PlayerPoint records =====
      const latestMatch = matches.length > 0 ? matches[matches.length - 1] : null;
      const latestTournament = latestMatch?.tournament || null;

      if (matchWinPoints > 0) {
        await db.playerPoint.create({
          data: {
            playerId: player.id,
            amount: matchWinPoints,
            reason: 'match_win',
            description: `${totalMatchWins} win × 1 pt (recalculated)`,
            tournamentId: latestTournament?.id || null,
            seasonId: latestTournament?.seasonId || null,
          },
        });
      }

      if (streakBonusPoints > 0) {
        await db.playerPoint.create({
          data: {
            playerId: player.id,
            amount: streakBonusPoints,
            reason: 'streak_bonus',
            description: `Streak bonus (max streak: ${maxStreak}, recalculated)`,
            tournamentId: latestTournament?.id || null,
            seasonId: latestTournament?.seasonId || null,
          },
        });
      }

      // ===== STEP 6: Update Participation.pointsEarned =====
      // Recalculate per-tournament pointsEarned for each participation
      // Group matches by tournament to get per-tournament breakdown
      const participations = await db.participation.findMany({
        where: { playerId: player.id },
      });

      for (const participation of participations) {
        // Get matches for this specific tournament
        const tournamentMatches = matches.filter(m => m.tournamentId === participation.tournamentId);
        const tournamentTeamPlayers = await db.teamPlayer.findMany({
          where: { 
            playerId: player.id,
            team: { tournamentId: participation.tournamentId },
          },
          select: { teamId: true },
        });
        const tTeamIds = tournamentTeamPlayers.map(tp => tp.teamId);

        let tMatchWin = 0;
        let tStreakBefore = 0; // We can't perfectly reconstruct per-tournament streak
        let tPrizePoints = 0;

        // Count match wins in this tournament
        for (const match of tournamentMatches) {
          if (!match.winnerId) continue;
          const isOnTeam = tTeamIds.includes(match.team1Id || '') || tTeamIds.includes(match.team2Id || '');
          if (!isOnTeam) continue;
          if (tTeamIds.includes(match.winnerId)) {
            tMatchWin += 1;
          }
        }

        // Prize points from PlayerPoint records for this tournament
        const tPrizeRecords = player.pointRecords.filter(
          r => prizeReasons.includes(r.reason) && r.tournamentId === participation.tournamentId
        );
        tPrizePoints = tPrizeRecords.reduce((sum, r) => sum + r.amount, 0);

        // Streak bonus for this tournament (simplified: calculate from matches in this tournament only)
        let tStreak = 0;
        let tStreakBonus = 0;
        for (const match of tournamentMatches) {
          if (!match.winnerId) continue;
          const isOnTeam = tTeamIds.includes(match.team1Id || '') || tTeamIds.includes(match.team2Id || '');
          if (!isOnTeam) continue;
          if (tTeamIds.includes(match.winnerId)) {
            const oldStreakBonus = Math.floor(tStreak / 3) * 2;
            tStreak++;
            const newStreakBonus = Math.floor(tStreak / 3) * 2;
            tStreakBonus += newStreakBonus - oldStreakBonus;
          } else {
            tStreak = 0;
          }
        }

        const tTotalPoints = tMatchWin + tStreakBonus + tPrizePoints;

        // Update participation with correct points and isWinner flag
        await db.participation.update({
          where: { id: participation.id },
          data: {
            pointsEarned: tTotalPoints,
            // isWinner should reflect whether the player's team won the tournament (not individual matches)
            // This is already set correctly during tournament finalization
          },
        });
      }

      // ===== STEP 7: Calculate new total and update Player =====
      const newTotalPoints = matchWinPoints + streakBonusPoints + prizeTotal;

      // Update player with new points, correct streak, and correct stats
      await db.player.update({
        where: { id: player.id },
        data: {
          points: newTotalPoints,
          totalWins: totalMatchWins,
          matches: totalMatchCount,
          streak: currentStreak,
          maxStreak: maxStreak,
        },
      });

      results.push({
        playerId: player.id,
        gamertag: player.gamertag,
        oldPoints: player.points,
        newPoints: newTotalPoints,
        breakdown: {
          matchWin: matchWinPoints,
          streakBonus: streakBonusPoints,
          prize: prizeTotal,
          total: newTotalPoints,
        },
      });
    }

    // Sort by new points descending
    results.sort((a, b) => b.newPoints - a.newPoints);

    return NextResponse.json({
      success: true,
      message: `Recalculated points for ${results.length} players using new system`,
      newRules: {
        matchWin: '+1 pt per win (ALL formats)',
        streakBonus: '+2 pts per 3 consecutive wins (ALL formats)',
        prize: 'Unchanged (from TournamentPrize)',
      },
      totalPlayers: results.length,
      results,
    });

  } catch (error) {
    console.error('Recalculation error:', error);
    return NextResponse.json({ error: 'Recalculation failed' }, { status: 500 });
  }
}
