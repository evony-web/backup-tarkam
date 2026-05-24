import { db, neonTransaction, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { getSafeErrorMessage } from '@/lib/api-error';
import { createAuditLog } from '@/lib/audit';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// Input validation schema for score submission
const scoreSchema = z.object({
  matchId: z.string().min(1, 'matchId required'),
  score1: z.number().int().min(0, 'Score must be >= 0').max(99, 'Score too high'),
  score2: z.number().int().min(0, 'Score must be >= 0').max(99, 'Score too high'),
});

// ===== Helper: Parse groupLabel position (e.g., "U2-3" → round=2, pos=3, "L1-2" → round=1, pos=2) =====
function parseLabel(label: string | null): { prefix: string; round: number; pos: number } | null {
  if (!label) return null;
  const match = label.match(/^([UL])(\d+)-(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], round: parseInt(match[2]), pos: parseInt(match[3]) };
}

// ===== Helper: Update club stats for a player's club =====
// IMPORTANT: Must be called OUTSIDE of $transaction to avoid long-running transactions
async function updateClubStatsForPlayer(
  playerId: string,
  tournamentDivision: string,
  seasonId: string,
  type: 'win' | 'loss' | 'draw',
  gameDiff: number
) {
  try {
    // Find the player's club season entry in the same division and season
    const membership = await db.clubMember.findFirst({
      where: {
        playerId,
        leftAt: null,
        profile: {
          seasonEntries: {
            some: { division: tournamentDivision, seasonId },
          },
        },
      },
      include: { profile: { include: { seasonEntries: { where: { division: tournamentDivision, seasonId } } } } },
    });

    if (!membership) return;

    // Get the Club season entry to update stats
    const clubEntry = membership.profile.seasonEntries[0];
    if (!clubEntry) return;

    if (type === 'win') {
      await db.club.update({
        where: { id: clubEntry.id },
        data: {
          wins: { increment: 1 },
          points: { increment: 2 },
          gameDiff: { increment: gameDiff },
        },
      });
    } else if (type === 'loss') {
      const lossPoints = gameDiff > -Math.abs(gameDiff) ? 1 : 0; // +1 point if they won at least 1 game
      await db.club.update({
        where: { id: clubEntry.id },
        data: {
          losses: { increment: 1 },
          points: { increment: Math.max(0, lossPoints) },
          gameDiff: { increment: gameDiff },
        },
      });
    } else if (type === 'draw') {
      await db.club.update({
        where: { id: clubEntry.id },
        data: {
          points: { increment: 1 },
        },
      });
    }
  } catch (error) {
    // Club stats are non-critical — log but don't fail the score submission
    console.error('Club stats update failed (non-critical):', error);
  }
}

// ===== Helper =====
function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ===== SCORE SUBMISSION =====
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  // Rate limit: 30 score submissions per minute per IP
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.SCORE_SUBMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak update skor. Tunggu sebentar.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { id } = await params;
  const body = await request.json();

  // Validate input with zod
  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => i.message).join(', ') },
      { status: 400 }
    );
  }
  const { matchId, score1, score2 } = parsed.data;

  try {
    // Collect club stats updates to apply AFTER the transaction
    // (calling db.club.update inside $transaction can cause long-running transactions)
    const clubStatsQueue: { playerId: string; type: 'win' | 'loss' | 'draw'; gameDiff: number }[] = [];
    let tournamentDivision = '';
    let tournamentSeasonId = '';

    // Use transaction for data integrity (Bug #3 fix)
    // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
    const result = await neonTransaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          tournament: true,
          team1: { include: { teamPlayers: { include: { player: true } } } },
          team2: { include: { teamPlayers: { include: { player: true } } } },
        },
      });

      if (!match) throw new Error('Match not found');
      if (match.tournamentId !== id) throw new Error('Match does not belong to this tournament');

      // Bug #8 fix: Optimistic locking - check status within transaction
      if (match.status === 'completed') throw new Error('Match already completed');
      if (!match.team1Id || !match.team2Id) throw new Error('Both teams must be set before scoring');

      const isGroupMatch = match.bracket === 'group';
      const isSwissMatch = match.bracket === 'swiss';
      const isDraw = score1 === score2;

      // Determine winner and loser
      const winnerId = score1 > score2 ? match.team1Id : score2 > score1 ? match.team2Id : null;
      const loserId = score1 > score2 ? match.team2Id : score2 > score1 ? match.team1Id : null;

      // Only allow draws in group stage and Swiss format
      if (isDraw && !isGroupMatch && !isSwissMatch) {
        throw new Error('Draws are not allowed in elimination brackets');
      }

      tournamentDivision = match.tournament.division;
      tournamentSeasonId = match.tournament.seasonId;
      const gameDiff = Math.abs((score1 || 0) - (score2 || 0));

      if (isDraw && (isGroupMatch || isSwissMatch)) {
        // Handle draw in group stage or Swiss format
        const updatedMatch = await tx.match.update({
          where: { id: matchId },
          data: { score1, score2, status: 'completed', completedAt: new Date() },
        });

        // Draw = no points for players (only wins, streak, and prize juara give points)
        // Just update match count for all players
        for (const team of [match.team1!, match.team2!]) {
          for (const tp of team.teamPlayers) {
            const participation = await tx.participation.findUnique({
              where: { playerId_tournamentId: { playerId: tp.playerId, tournamentId: id } },
            });
            if (participation) {
              // No points for draw — only match count updated
              await tx.player.update({
                where: { id: tp.playerId },
                data: { matches: tp.player.matches + 1 },
              });
            }

            // Queue club stats update (outside transaction to keep transactions short)
            clubStatsQueue.push({ playerId: tp.playerId, type: 'draw', gameDiff: 0 });
          }
        }

        return { updatedMatch, draw: true };
      }

      // Non-draw match — there is a winner
      if (!winnerId) throw new Error('No winner determined');

      const winningTeam = match.team1Id === winnerId ? match.team1! : match.team2!;
      const losingTeam = match.team1Id === loserId ? match.team1! : match.team2!;
      const matchLabel = `R${match.round}M${match.matchNumber} ${winningTeam.name} vs ${losingTeam.name}`;

      // Update the match
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          score1, score2, status: 'completed',
          winnerId, loserId, completedAt: new Date(),
        },
      });

      // ===== AWARD MATCH POINTS WITH AUDIT TRAIL =====
      // Winner: +1 pt per win (ALL formats including Swiss)
      // Streak bonus: +2 pts for every 3 consecutive wins (ALL formats)
      const tournamentFormat = match.tournament.format || 'single_elimination';

      for (const tp of winningTeam.teamPlayers) {
        const participation = await tx.participation.findUnique({
          where: { playerId_tournamentId: { playerId: tp.playerId, tournamentId: id } },
        });

        if (participation) {
          const winPts = 1; // +1 pt per win for ALL formats
          const player = tp.player;
          const newStreak = player.streak + 1;

          // Streak bonus: +2 pts for every 3 consecutive wins (applies to ALL formats)
          // e.g. streak 3 = +2, streak 6 = +4, etc.
          const oldStreakBonus = Math.floor(player.streak / 3) * 2;
          const newStreakBonus = Math.floor(newStreak / 3) * 2;
          const streakBonus = newStreakBonus - oldStreakBonus; // Only the incremental bonus

          const totalPts = winPts + streakBonus;

          await tx.participation.update({
            where: { id: participation.id },
            data: { pointsEarned: participation.pointsEarned + totalPts },
            // NOTE: isWinner is NOT set here — it's set during tournament finalization
            // and means "tournament champion (Juara 1)", NOT "won a match"
          });

          await tx.playerPoint.create({
            data: {
              playerId: tp.playerId, amount: winPts, reason: 'match_win',
              description: `Menang match ${matchLabel}`, tournamentId: id, matchId,
              seasonId: match.tournament.seasonId,
            },
          });

          if (streakBonus > 0) {
            await tx.playerPoint.create({
              data: {
                playerId: tp.playerId, amount: streakBonus, reason: 'streak_bonus',
                description: `Streak bonus ${newStreak} berturut-turut`, tournamentId: id, matchId,
                seasonId: match.tournament.seasonId,
              },
            });
          }

          await tx.player.update({
            where: { id: tp.playerId },
            data: {
              totalWins: player.totalWins + 1,
              matches: player.matches + 1,
              streak: newStreak,
              maxStreak: Math.max(newStreak, player.maxStreak),
              points: player.points + totalPts,
            },
          });

          // Queue club stats update (outside transaction to keep transactions short)
          clubStatsQueue.push({ playerId: tp.playerId, type: 'win', gameDiff });
        }
      }

      // Losing team: 0 pts (no participation points, no loss points)
      for (const tp of losingTeam.teamPlayers) {
        const participation = await tx.participation.findUnique({
          where: { playerId_tournamentId: { playerId: tp.playerId, tournamentId: id } },
        });

        if (participation) {
          await tx.participation.update({
            where: { id: participation.id },
            data: { pointsEarned: participation.pointsEarned + 0 },
          });

          await tx.player.update({
            where: { id: tp.playerId },
            data: {
              matches: tp.player.matches + 1,
              streak: 0,
              // points unchanged — 0 pts for losing
            },
          });

          // Queue club stats update (outside transaction to keep transactions short)
          clubStatsQueue.push({ playerId: tp.playerId, type: 'loss', gameDiff: -gameDiff });
        }
      }

      return { updatedMatch, draw: false, winnerId, loserId };
    });

    // ===== CLUB STATS UPDATE (outside transaction to keep transactions short) =====
    // These are non-critical updates — failure should not block score submission
    if (clubStatsQueue.length > 0 && tournamentDivision && tournamentSeasonId) {
      // Process sequentially to keep database load manageable
      for (const { playerId, type, gameDiff } of clubStatsQueue) {
        await updateClubStatsForPlayer(playerId, tournamentDivision, tournamentSeasonId, type, gameDiff);
      }
    }

    // ===== BRACKET ADVANCEMENT (outside transaction for complex queries) =====
    const tournament2 = await db.tournament.findUnique({ where: { id } });
    if (!tournament2) return NextResponse.json(result.updatedMatch);

    const format = tournament2.format;
    const match2 = await db.match.findUnique({ where: { id: matchId } });
    if (!match2) return NextResponse.json(result.updatedMatch);

    const currentRound = match2.round;
    const bracket = match2.bracket;
    const winnerId = result.winnerId ?? null;
    const loserId = result.loserId ?? null;

    // Group match — check if group stage is done
    if (bracket === 'group' && format === 'group_stage') {
      await checkAndSeedPlayoffs(id);
      await checkAllMatchesComplete(id);
      return NextResponse.json(result.updatedMatch);
    }

    // Playoff match advancement for group_stage format (double elimination)
    if (format === 'group_stage' && (bracket === 'upper' || bracket === 'lower' || bracket === 'grand_final') && match2.round >= 2) {
      await advanceGroupStagePlayoff(id, match2, winnerId, loserId);
      await checkAllMatchesComplete(id);
      return NextResponse.json(result.updatedMatch);
    }

    // Upper Semi (Double Elimination) advancement — handles UB, LB, and GF
    if (format === 'upper_semi') {
      await advanceUpperSemi(id, match2, winnerId, loserId);
    }

    // Single elimination upper bracket advancement (not upper_semi — that has its own handler)
    if (bracket === 'upper' && format !== 'group_stage' && format !== 'upper_semi') {
      const label = parseLabel(match2.groupLabel);
      const currentPos = label?.pos || 1;

      // Winner advances to next upper round
      const nextRound = currentRound + 1;
      const nextPos = Math.ceil(currentPos / 2);
      const nextMatch = await db.match.findFirst({
        where: { tournamentId: id, round: nextRound, bracket: 'upper', groupLabel: `U${nextRound}-${nextPos}` },
      });

      if (nextMatch && winnerId) {
        const isOdd = currentPos % 2 === 1;
        await db.match.update({
          where: { id: nextMatch.id },
          data: isOdd ? { team1Id: winnerId } : { team2Id: winnerId },
        });
        const updated = await db.match.findUnique({ where: { id: nextMatch.id } });
        if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
          await db.match.update({ where: { id: nextMatch.id }, data: { status: 'ready' } });
        }
      }
    }

    // Swiss match — check if current round complete and advance
    if (bracket === 'swiss' && format === 'swiss') {
      await handleSwissAdvancement(id, match2.round);
    }

    // Swiss playoff match advancement (SF1, SF2, Final, 3rd after Swiss rounds)
    if (format === 'swiss' && bracket !== 'swiss') {
      await advanceSwissPlayoff(id, match2, winnerId, loserId);
    }

    // Swiss match — check if current round complete and advance
    if (bracket === 'swiss' && format === 'swiss') {
      await handleSwissAdvancement(id, match2.round);
    }

    // Swiss playoff match advancement (SF1, SF2, Final, 3rd after Swiss rounds)
    if (format === 'swiss' && bracket !== 'swiss') {
      await advanceSwissPlayoff(id, match2, winnerId, loserId);
    }

    await checkAllMatchesComplete(id);

    // Pusher: Debounced notification — batches rapid score updates
    // Instead of 3 separate triggers per score, send ONE after 1.5s of silence
    try {
      const { notifyScoreUpdate } = await import('@/lib/pusher-debounce');
      notifyScoreUpdate(id, {
        matchId, score1, score2,
        division: tournamentDivision,
        seasonId: tournamentSeasonId,
      });
    } catch { /* non-critical */ }

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'match',
      entityId: matchId,
      details: `Update score: ${score1}-${score2}`,
      metadata: { tournamentId: id, matchId, score1, score2 },
    });

    return NextResponse.json(result.updatedMatch);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'Match already completed') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === 'Match not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Score submission error:', error);
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 });
  }
}

// ===== Helper: Advance group stage playoff matches (Double Elimination) =====
async function advanceGroupStagePlayoff(
  tournamentId: string,
  match: { id: string; round: number; matchNumber: number; bracket: string; groupLabel: string | null },
  winnerId: string | null,
  loserId: string | null
) {
  const label = match.groupLabel;
  if (!label) return;

  // Check if this is an old-style bracket (SF1, SF2, Final, 3rd) for backward compat
  const isOldStyle = ['SF1', 'SF2', 'Final', '3rd', 'QF1', 'QF2', 'QF3', 'QF4'].includes(label) || label?.startsWith('R');
  if (isOldStyle) return; // Don't advance old-style brackets with new logic

  // Count groups to determine playoff structure
  const groupMatches = await db.match.findMany({
    where: { tournamentId, bracket: 'group' },
  });
  const numGroups = new Set(groupMatches.map(m => m.groupLabel)).size;

  // Define advancement mapping — same pattern as advanceUpperSemi
  type Advancement = { winner?: { targetLabel: string; slot: 'team1Id' | 'team2Id' }; loser?: { targetLabel: string; slot: 'team1Id' | 'team2Id' } };

  // 4-team double elimination (1-3 groups) — NEW FORMAT
  // Rank 3 from groups is pre-seeded into L1 as team1; Upper SF loser fills team2
  // Flow: U1 losers → L1 team2, L1 winners → L2, U2-1 loser → L3 team1, L2 winner → L3 team2, L3 winner → GF
  const advancementMap4: Record<string, Advancement> = {
    'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team1Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
    'U1-2': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-2', slot: 'team2Id' } },
    'U2-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L3-1', slot: 'team1Id' } },
    'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team1Id' } },
    'L1-2': { winner: { targetLabel: 'L2-1', slot: 'team2Id' } },
    'L2-1': { winner: { targetLabel: 'L3-1', slot: 'team2Id' } },
    'L3-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
  };

  // 8-team double elimination (4 groups) — NEW FORMAT
  // Rank 3 from each group is pre-seeded into L1 as team1; Upper QF loser fills team2
  // Flow: U1 losers → L1 team2, L1 winners → L2, U2 losers → L3 (cross), L2 winners → L3 (cross), L3 winners → L4, U3 loser → L4 team1
  const advancementMap8: Record<string, Advancement> = {
    'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team1Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
    'U1-2': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-2', slot: 'team2Id' } },
    'U1-3': { winner: { targetLabel: 'U2-2', slot: 'team1Id' }, loser: { targetLabel: 'L1-3', slot: 'team2Id' } },
    'U1-4': { winner: { targetLabel: 'U2-2', slot: 'team2Id' }, loser: { targetLabel: 'L1-4', slot: 'team2Id' } },
    'U2-1': { winner: { targetLabel: 'U3-1', slot: 'team1Id' }, loser: { targetLabel: 'L3-2', slot: 'team2Id' } },
    'U2-2': { winner: { targetLabel: 'U3-1', slot: 'team2Id' }, loser: { targetLabel: 'L3-1', slot: 'team2Id' } },
    'U3-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L4-1', slot: 'team1Id' } },
    'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team1Id' } },
    'L1-2': { winner: { targetLabel: 'L2-1', slot: 'team2Id' } },
    'L1-3': { winner: { targetLabel: 'L2-2', slot: 'team1Id' } },
    'L1-4': { winner: { targetLabel: 'L2-2', slot: 'team2Id' } },
    'L2-1': { winner: { targetLabel: 'L3-1', slot: 'team1Id' } },
    'L2-2': { winner: { targetLabel: 'L3-2', slot: 'team1Id' } },
    'L3-1': { winner: { targetLabel: 'L4-1', slot: 'team1Id' } },
    'L3-2': { winner: { targetLabel: 'L4-1', slot: 'team2Id' } },
    'L4-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
  };

  let advancementMap: Record<string, Advancement> | null = null;
  if (numGroups <= 3) {
    advancementMap = advancementMap4;
  } else if (numGroups === 4) {
    advancementMap = advancementMap8;
  } else {
    // 5+ groups: Build a generic advancement map based on bracket labels
    // NEW FORMAT: L1 matches have team1 = rank 3 (pre-seeded), upper losers go to team2
    const allPlayoffMatches = await db.match.findMany({
      where: { tournamentId, bracket: { in: ['upper', 'lower', 'grand_final'] } },
    });
    const upperMatches = allPlayoffMatches.filter(m => m.bracket === 'upper');
    const lowerMatches = allPlayoffMatches.filter(m => m.bracket === 'lower');

    const genericMap: Record<string, Advancement> = {};

    // Upper bracket advancement
    const upperRounds = [...new Set(upperMatches.map(m => m.round))].sort((a, b) => a - b);
    for (let ri = 0; ri < upperRounds.length; ri++) {
      const roundMatches = upperMatches.filter(m => m.round === upperRounds[ri]).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
      const isLastUpperRound = ri === upperRounds.length - 1;
      const isFirstUpperRound = ri === 0;

      for (let mi = 0; mi < roundMatches.length; mi++) {
        const m = roundMatches[mi];
        const mLabel = m.groupLabel;
        if (!mLabel) continue;

        const entry: Advancement = {};

        if (isLastUpperRound) {
          // Upper final: winner → GF, loser → LB final
          entry.winner = { targetLabel: 'GF', slot: 'team1Id' };
          // Find lower bracket final match
          const lbFinalRound = Math.max(...lowerMatches.map(m => m.round));
          const lbFinal = lowerMatches.find(m => m.round === lbFinalRound);
          if (lbFinal?.groupLabel) {
            entry.loser = { targetLabel: lbFinal.groupLabel, slot: 'team1Id' };
          }
        } else {
          // Standard upper bracket advancement
          const nextRoundMatches = upperMatches.filter(m => m.round === upperRounds[ri + 1]).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
          const targetIdx = Math.floor(mi / 2);
          const slot: 'team1Id' | 'team2Id' = mi % 2 === 0 ? 'team1Id' : 'team2Id';
          if (nextRoundMatches[targetIdx]?.groupLabel) {
            entry.winner = { targetLabel: nextRoundMatches[targetIdx].groupLabel!, slot };
          }

          // Loser goes to lower bracket
          // First upper round (U1) losers go to L1 team2 (rank 3 already has team1)
          // Later upper round losers go to appropriate LB rounds
          if (isFirstUpperRound) {
            // U1 losers → L1 team2 (rank 3 already has team1)
            const lbL1Matches = lowerMatches.filter(m => {
              const lbLabel = m.groupLabel;
              if (!lbLabel) return false;
              return lbLabel.match(/^L1-\d+$/);
            }).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

            if (lbL1Matches[mi]?.groupLabel) {
              entry.loser = { targetLabel: lbL1Matches[mi].groupLabel!, slot: 'team2Id' };
            }
          } else {
            // Later upper round losers → appropriate lower bracket round
            const lowerRoundForDrop = (ri + 1) * 2 - 1; // L3 for U2, L5 for U3, etc.
            const lbDropMatches = lowerMatches.filter(m => {
              const lbLabel = m.groupLabel;
              if (!lbLabel) return false;
              const lbMatch = lbLabel.match(/^L(\d+)-(\d+)$/);
              if (!lbMatch) return false;
              return parseInt(lbMatch[1]) === lowerRoundForDrop;
            }).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

            if (lbDropMatches.length > 0 && lbDropMatches[mi]?.groupLabel) {
              entry.loser = { targetLabel: lbDropMatches[mi].groupLabel!, slot: 'team2Id' };
            }
          }
        }

        genericMap[mLabel] = entry;
      }
    }

    // Lower bracket advancement
    const lowerRounds = [...new Set(lowerMatches.map(m => m.round))].sort((a, b) => a - b);
    for (let ri = 0; ri < lowerRounds.length; ri++) {
      const roundMatches = lowerMatches.filter(m => m.round === lowerRounds[ri]).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
      const isLastLowerRound = ri === lowerRounds.length - 1;

      for (let mi = 0; mi < roundMatches.length; mi++) {
        const m = roundMatches[mi];
        const mLabel = m.groupLabel;
        if (!mLabel || genericMap[mLabel]) continue; // Already set by drop logic

        const entry: Advancement = {};

        if (isLastLowerRound) {
          // Lower final: winner → GF
          entry.winner = { targetLabel: 'GF', slot: 'team2Id' };
        } else {
          // Standard lower bracket advancement
          const nextRoundMatches = lowerMatches.filter(m => m.round === lowerRounds[ri + 1]).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
          const targetIdx = Math.floor(mi / 2);
          const slot: 'team1Id' | 'team2Id' = mi % 2 === 0 ? 'team1Id' : 'team2Id';
          if (nextRoundMatches[targetIdx]?.groupLabel) {
            entry.winner = { targetLabel: nextRoundMatches[targetIdx].groupLabel!, slot };
          }
        }

        genericMap[mLabel] = entry;
      }
    }

    advancementMap = genericMap;
  }

  if (!advancementMap) return;

  const matchAdvancement = advancementMap[label];
  if (!matchAdvancement) return; // No advancement for this match (e.g., GF)

  // Advance winner
  if (matchAdvancement.winner && winnerId) {
    const { targetLabel, slot } = matchAdvancement.winner;
    const targetMatch = await db.match.findFirst({
      where: { tournamentId, groupLabel: targetLabel },
    });
    if (targetMatch) {
      await db.match.update({
        where: { id: targetMatch.id },
        data: { [slot]: winnerId },
      });
      const updated = await db.match.findUnique({ where: { id: targetMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: targetMatch.id }, data: { status: 'ready' } });
      }
    }
  }

  // Advance loser
  if (matchAdvancement.loser && loserId) {
    const { targetLabel, slot } = matchAdvancement.loser;
    const targetMatch = await db.match.findFirst({
      where: { tournamentId, groupLabel: targetLabel },
    });
    if (targetMatch) {
      await db.match.update({
        where: { id: targetMatch.id },
        data: { [slot]: loserId },
      });
      const updated = await db.match.findUnique({ where: { id: targetMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: targetMatch.id }, data: { status: 'ready' } });
      }
    }
  }
}

// ===== Helper: Advance Upper Semi (Double Elimination) matches =====
async function advanceUpperSemi(
  tournamentId: string,
  match: { id: string; round: number; matchNumber: number; bracket: string; groupLabel: string | null },
  winnerId: string | null,
  loserId: string | null
) {
  const label = match.groupLabel;
  if (!label) return;

  // Get tournament to determine team count
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return;

  const teams = await db.team.findMany({ where: { tournamentId } });
  const teamCount = teams.length;

  // Define advancement mapping per team count
  // Each entry: { winner?: { label, slot }, loser?: { label, slot } }
  // slot: 'team1Id' | 'team2Id'
  type Advancement = { winner?: { targetLabel: string; slot: 'team1Id' | 'team2Id' }; loser?: { targetLabel: string; slot: 'team1Id' | 'team2Id' } };
  const advancementMap: Record<string, Record<string, Advancement>> = {
    '4': {
      'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team1Id' }, loser: { targetLabel: 'L1-1', slot: 'team1Id' } },
      'U1-2': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
      'U2-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L2-1', slot: 'team1Id' } },
      'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team2Id' } },
      'L2-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
    },
    '5': {
      'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team1Id' } },
      'U2-1': { winner: { targetLabel: 'U3-1', slot: 'team1Id' }, loser: { targetLabel: 'L2-1', slot: 'team2Id' } },
      'U2-2': { winner: { targetLabel: 'U3-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
      'U3-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L3-1', slot: 'team1Id' } },
      'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team1Id' } },
      'L2-1': { winner: { targetLabel: 'L3-1', slot: 'team2Id' } },
      'L3-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
    },
    '6': {
      'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team1Id' } },
      'U1-2': { winner: { targetLabel: 'U2-2', slot: 'team2Id' }, loser: { targetLabel: 'L1-2', slot: 'team1Id' } },
      'U2-1': { winner: { targetLabel: 'U3-1', slot: 'team1Id' }, loser: { targetLabel: 'L1-2', slot: 'team2Id' } },
      'U2-2': { winner: { targetLabel: 'U3-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
      'U3-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L3-1', slot: 'team1Id' } },
      'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team1Id' } },
      'L1-2': { winner: { targetLabel: 'L2-1', slot: 'team2Id' } },
      'L2-1': { winner: { targetLabel: 'L3-1', slot: 'team2Id' } },
      'L3-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
    },
    '7': {
      'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L2-1', slot: 'team1Id' } },
      'U1-2': { winner: { targetLabel: 'U2-2', slot: 'team1Id' }, loser: { targetLabel: 'L1-1', slot: 'team1Id' } },
      'U1-3': { winner: { targetLabel: 'U2-2', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
      'U2-1': { winner: { targetLabel: 'U3-1', slot: 'team1Id' }, loser: { targetLabel: 'L3-1', slot: 'team1Id' } },
      'U2-2': { winner: { targetLabel: 'U3-1', slot: 'team2Id' }, loser: { targetLabel: 'L3-1', slot: 'team2Id' } },
      'U3-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L5-1', slot: 'team1Id' } },
      'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team2Id' } },
      'L2-1': { winner: { targetLabel: 'L4-1', slot: 'team1Id' } },
      'L3-1': { winner: { targetLabel: 'L4-1', slot: 'team2Id' } },
      'L4-1': { winner: { targetLabel: 'L5-1', slot: 'team2Id' } },
      'L5-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
    },
    '8': {
      'U1-1': { winner: { targetLabel: 'U2-1', slot: 'team1Id' }, loser: { targetLabel: 'L1-1', slot: 'team1Id' } },
      'U1-2': { winner: { targetLabel: 'U2-1', slot: 'team2Id' }, loser: { targetLabel: 'L1-1', slot: 'team2Id' } },
      'U1-3': { winner: { targetLabel: 'U2-2', slot: 'team1Id' }, loser: { targetLabel: 'L1-2', slot: 'team1Id' } },
      'U1-4': { winner: { targetLabel: 'U2-2', slot: 'team2Id' }, loser: { targetLabel: 'L1-2', slot: 'team2Id' } },
      'U2-1': { winner: { targetLabel: 'U3-1', slot: 'team1Id' }, loser: { targetLabel: 'L2-2', slot: 'team2Id' } },
      'U2-2': { winner: { targetLabel: 'U3-1', slot: 'team2Id' }, loser: { targetLabel: 'L2-1', slot: 'team2Id' } },
      'U3-1': { winner: { targetLabel: 'GF', slot: 'team1Id' }, loser: { targetLabel: 'L4-1', slot: 'team1Id' } },
      'L1-1': { winner: { targetLabel: 'L2-1', slot: 'team1Id' } },
      'L1-2': { winner: { targetLabel: 'L2-2', slot: 'team1Id' } },
      'L2-1': { winner: { targetLabel: 'L3-1', slot: 'team1Id' } },
      'L2-2': { winner: { targetLabel: 'L3-1', slot: 'team2Id' } },
      'L3-1': { winner: { targetLabel: 'L4-1', slot: 'team2Id' } },
      'L4-1': { winner: { targetLabel: 'GF', slot: 'team2Id' } },
    },
  };

  const teamKey = String(teamCount);
  const teamMap = advancementMap[teamKey];
  if (!teamMap) return; // Unsupported team count

  const matchAdvancement = teamMap[label];
  if (!matchAdvancement) return; // No advancement for this match (e.g., GF)

  // Advance winner
  if (matchAdvancement.winner && winnerId) {
    const { targetLabel, slot } = matchAdvancement.winner;
    const targetMatch = await db.match.findFirst({
      where: { tournamentId, groupLabel: targetLabel },
    });
    if (targetMatch) {
      await db.match.update({
        where: { id: targetMatch.id },
        data: { [slot]: winnerId },
      });
      const updated = await db.match.findUnique({ where: { id: targetMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: targetMatch.id }, data: { status: 'ready' } });
      }
    }
  }

  // Advance loser
  if (matchAdvancement.loser && loserId) {
    const { targetLabel, slot } = matchAdvancement.loser;
    const targetMatch = await db.match.findFirst({
      where: { tournamentId, groupLabel: targetLabel },
    });
    if (targetMatch) {
      await db.match.update({
        where: { id: targetMatch.id },
        data: { [slot]: loserId },
      });
      const updated = await db.match.findUnique({ where: { id: targetMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: targetMatch.id }, data: { status: 'ready' } });
      }
    }
  }
}

// ===== Helper: Handle Swiss advancement after scoring =====
async function handleSwissAdvancement(tournamentId: string, completedRound: number) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.format !== 'swiss') return;

  // Check if all Swiss matches in the completed round are done
  const roundMatches = await db.match.findMany({
    where: { tournamentId, bracket: 'swiss', round: completedRound },
  });

  const allRoundDone = roundMatches.length > 0 && roundMatches.every(m => m.status === 'completed');
  if (!allRoundDone) return;

  // Determine total Swiss rounds needed
  const allTeams = await db.team.findMany({ where: { tournamentId } });
  const teamCount = allTeams.length;
  const totalSwissRounds = Math.ceil(Math.log2(teamCount)) + 2;

  if (completedRound >= totalSwissRounds) {
    // All Swiss rounds complete → seed playoff
    await seedSwissPlayoff(tournamentId);
  } else {
    // Generate next Swiss round
    await generateNextSwissRound(tournamentId, completedRound);
  }
}

// ===== Helper: Swiss standings type =====
interface SwissStanding {
  teamId: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  buchholz: number;
}

// ===== Helper: Compute Swiss standings from completed matches =====
async function computeSwissStandings(tournamentId: string): Promise<SwissStanding[]> {
  // Get all completed Swiss matches
  const swissMatches = await db.match.findMany({
    where: { tournamentId, bracket: 'swiss', status: 'completed' },
  });

  // Get all teams in the tournament
  const allTeams = await db.team.findMany({ where: { tournamentId } });

  // Initialize standings for every team
  const standingsMap = new Map<string, SwissStanding>();
  for (const team of allTeams) {
    standingsMap.set(team.id, {
      teamId: team.id,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      buchholz: 0,
    });
  }

  // Track opponents for each team (for buchholz calculation)
  const opponentsMap = new Map<string, Set<string>>();
  for (const team of allTeams) {
    opponentsMap.set(team.id, new Set());
  }

  // Process each match
  for (const m of swissMatches) {
    if (!m.team1Id || !m.team2Id) {
      // BYE match: team1 gets auto-win
      if (m.team1Id) {
        const standing = standingsMap.get(m.team1Id);
        if (standing) {
          standing.wins++;
          standing.points += 3;
        }
      }
      continue;
    }

    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;
    const t1Standing = standingsMap.get(m.team1Id);
    const t2Standing = standingsMap.get(m.team2Id);

    // Track opponents
    opponentsMap.get(m.team1Id)?.add(m.team2Id);
    opponentsMap.get(m.team2Id)?.add(m.team1Id);

    if (t1Standing && t2Standing) {
      if (s1 > s2) {
        t1Standing.wins++;
        t1Standing.points += 3;
        t2Standing.losses++;
      } else if (s2 > s1) {
        t2Standing.wins++;
        t2Standing.points += 3;
        t1Standing.losses++;
      } else {
        t1Standing.draws++;
        t2Standing.draws++;
        t1Standing.points += 1;
        t2Standing.points += 1;
      }
    }
  }

  // Calculate buchholz (sum of all opponents' points)
  for (const [teamId, standing] of standingsMap) {
    const opponents = opponentsMap.get(teamId);
    if (opponents) {
      let buchholz = 0;
      for (const oppId of opponents) {
        const oppStanding = standingsMap.get(oppId);
        if (oppStanding) {
          buchholz += oppStanding.points;
        }
      }
      standing.buchholz = buchholz;
    }
  }

  // Sort by: points DESC → buchholz DESC → wins DESC
  return Array.from(standingsMap.values()).sort((a, b) =>
    b.points - a.points || b.buchholz - a.buchholz || b.wins - a.wins
  );
}

// ===== Helper: Get previous matchups for no-rematch constraint =====
async function getPreviousMatchups(tournamentId: string): Promise<Map<string, Set<string>>> {
  const swissMatches = await db.match.findMany({
    where: { tournamentId, bracket: 'swiss' },
  });

  const matchups = new Map<string, Set<string>>();
  for (const m of swissMatches) {
    if (m.team1Id && m.team2Id) {
      if (!matchups.has(m.team1Id)) matchups.set(m.team1Id, new Set());
      if (!matchups.has(m.team2Id)) matchups.set(m.team2Id, new Set());
      matchups.get(m.team1Id)!.add(m.team2Id);
      matchups.get(m.team2Id)!.add(m.team1Id);
    }
  }
  return matchups;
}

// ===== Helper: Get teams that have had a BYE in previous rounds =====
async function getTeamsWithBye(tournamentId: string): Promise<Set<string>> {
  const byeMatches = await db.match.findMany({
    where: { tournamentId, bracket: 'swiss', team2Id: null, status: 'completed' },
  });
  const teamsWithBye = new Set<string>();
  for (const m of byeMatches) {
    if (m.team1Id) teamsWithBye.add(m.team1Id);
  }
  return teamsWithBye;
}

// ===== Helper: Generate next Swiss round =====
async function generateNextSwissRound(tournamentId: string, completedRound: number) {
  const nextRound = completedRound + 1;

  // Check if next round already exists (prevent double generation)
  const existingNextRound = await db.match.findFirst({
    where: { tournamentId, bracket: 'swiss', round: nextRound },
  });
  if (existingNextRound) return;

  const standings = await computeSwissStandings(tournamentId);
  const previousMatchups = await getPreviousMatchups(tournamentId);
  const teamsWithBye = await getTeamsWithBye(tournamentId);
  const matchFormat = (await db.tournament.findUnique({ where: { id: tournamentId } }))?.defaultMatchFormat || 'BO1';

  // Swiss pairing algorithm: group by points, pair within groups, no rematch
  const paired: [string, string][] = [];
  const pairedTeams = new Set<string>();

  // Group teams by points (descending order — standings are already sorted)
  const pointsGroups = new Map<number, string[]>();
  for (const s of standings) {
    const group = pointsGroups.get(s.points) || [];
    group.push(s.teamId);
    pointsGroups.set(s.points, group);
  }

  // Sort point groups by points descending
  const sortedPointValues = Array.from(pointsGroups.keys()).sort((a, b) => b - a);

  // Pair within each points group first
  for (const pts of sortedPointValues) {
    const group = pointsGroups.get(pts) || [];
    const available = group.filter(id => !pairedTeams.has(id));

    // Pair adjacent teams in the group, respecting no-rematch
    const pairedInGroup = new Set<string>();
    for (let i = 0; i < available.length; i++) {
      if (pairedInGroup.has(available[i])) continue;

      for (let j = i + 1; j < available.length; j++) {
        if (pairedInGroup.has(available[j])) continue;

        const team1 = available[i];
        const team2 = available[j];

        // Check no-rematch constraint
        const hasPlayed = previousMatchups.get(team1)?.has(team2) || false;
        if (!hasPlayed) {
          paired.push([team1, team2]);
          pairedInGroup.add(team1);
          pairedInGroup.add(team2);
          break; // Move to next unpaired team
        }
      }
    }
  }

  // Handle unpaired teams (cross-group pairing due to no-rematch constraints)
  const unpaired = standings
    .map(s => s.teamId)
    .filter(id => !pairedTeams.has(id) && !paired.some(p => p[0] === id || p[1] === id));

  // Try to pair unpaired teams across groups
  const stillUnpaired: string[] = [];
  const crossPaired = new Set<string>();
  for (let i = 0; i < unpaired.length; i++) {
    if (crossPaired.has(unpaired[i])) continue;

    let found = false;
    for (let j = i + 1; j < unpaired.length; j++) {
      if (crossPaired.has(unpaired[j])) continue;

      const hasPlayed = previousMatchups.get(unpaired[i])?.has(unpaired[j]) || false;
      if (!hasPlayed) {
        paired.push([unpaired[i], unpaired[j]]);
        crossPaired.add(unpaired[i]);
        crossPaired.add(unpaired[j]);
        found = true;
        break;
      }
    }
    if (!found) {
      stillUnpaired.push(unpaired[i]);
    }
  }

  // If still unpaired teams (all possible opponents already played), allow rematch
  // as last resort, pairing with closest-standing available opponent
  const finalUnpaired: string[] = [];
  const rematchPaired = new Set<string>();
  for (let i = 0; i < stillUnpaired.length; i++) {
    if (rematchPaired.has(stillUnpaired[i])) continue;

    for (let j = i + 1; j < stillUnpaired.length; j++) {
      if (rematchPaired.has(stillUnpaired[j])) continue;

      paired.push([stillUnpaired[i], stillUnpaired[j]]);
      rematchPaired.add(stillUnpaired[i]);
      rematchPaired.add(stillUnpaired[j]);
      break;
    }
  }

  // Collect ALL unpaired teams after cross-group and rematch attempts
  const allPairedTeams = new Set(paired.flat());
  const remainingUnpaired = standings
    .map(s => s.teamId)
    .filter(id => !allPairedTeams.has(id));

  // Handle odd number: bottom team gets a BYE (auto-win)
  // Prefer a team that hasn't had a BYE yet
  let byeTeam: string | null = null;
  if (remainingUnpaired.length === 1) {
    byeTeam = remainingUnpaired[0];
  } else if (remainingUnpaired.length > 1 && remainingUnpaired.length % 2 !== 0) {
    // Find the lowest-ranked team without a previous BYE
    for (let i = remainingUnpaired.length - 1; i >= 0; i--) {
      if (!teamsWithBye.has(remainingUnpaired[i])) {
        byeTeam = remainingUnpaired[i];
        remainingUnpaired.splice(i, 1);
        break;
      }
    }
    // If all remaining had a BYE, just give it to the lowest-ranked
    if (!byeTeam) {
      byeTeam = remainingUnpaired.pop()!;
    }
    // Pair the rest
    for (let i = 0; i < remainingUnpaired.length - 1; i += 2) {
      paired.push([remainingUnpaired[i], remainingUnpaired[i + 1]]);
    }
  } else if (remainingUnpaired.length > 0 && remainingUnpaired.length % 2 === 0) {
    // Even remaining unpaired — pair them up
    for (let i = 0; i < remainingUnpaired.length - 1; i += 2) {
      paired.push([remainingUnpaired[i], remainingUnpaired[i + 1]]);
    }
  }

  // Create Match records
  const maxMatchNumber = await db.match.findFirst({
    where: { tournamentId },
    orderBy: { matchNumber: 'desc' },
    select: { matchNumber: true },
  });
  let matchNumber = maxMatchNumber?.matchNumber || 0;

  for (let i = 0; i < paired.length; i++) {
    matchNumber++;
    const pairIndex = i + 1;
    await db.match.create({
      data: {
        tournamentId,
        round: nextRound,
        matchNumber,
        bracket: 'swiss',
        groupLabel: `SR${nextRound}-${pairIndex}`,
        format: matchFormat,
        team1Id: paired[i][0],
        team2Id: paired[i][1],
        status: 'ready',
      },
    });
  }

  // Create BYE match if needed
  if (byeTeam) {
    matchNumber++;
    const pairIndex = paired.length + 1;
    await db.match.create({
      data: {
        tournamentId,
        round: nextRound,
        matchNumber,
        bracket: 'swiss',
        groupLabel: `SR${nextRound}-${pairIndex}`,
        format: matchFormat,
        team1Id: byeTeam,
        team2Id: null,
        score1: 0,
        score2: 0,
        status: 'completed',
        winnerId: null, // No winner for BYE — team did not play
        completedAt: new Date(),
      },
    });

    // BYE: No points awarded — team did not play, only gets rest round

    // After BYE auto-complete, check if this round is now also complete (only BYE left)
    // and recursively trigger advancement
    await handleSwissAdvancement(tournamentId, nextRound);
  }
}

// ===== Helper: Seed Swiss playoff (top 4 teams) =====
async function seedSwissPlayoff(tournamentId: string) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return;

  // Check if playoffs already seeded
  const sf1 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'SF1' } });
  if (sf1?.team1Id) return; // Already seeded

  const standings = await computeSwissStandings(tournamentId);

  // Need at least 4 teams for playoff
  if (standings.length < 4) return;

  const top4 = standings.slice(0, 4);

  // Cross-seeding: 1st vs 4th (SF1), 2nd vs 3rd (SF2)
  const first = top4[0].teamId;
  const second = top4[1].teamId;
  const third = top4[2].teamId;
  const fourth = top4[3].teamId;

  // Update pre-created playoff matches
  const sf1Match = await db.match.findFirst({ where: { tournamentId, groupLabel: 'SF1' } });
  if (sf1Match) {
    await db.match.update({
      where: { id: sf1Match.id },
      data: { team1Id: first, team2Id: fourth, status: 'ready' },
    });
  }

  const sf2Match = await db.match.findFirst({ where: { tournamentId, groupLabel: 'SF2' } });
  if (sf2Match) {
    await db.match.update({
      where: { id: sf2Match.id },
      data: { team1Id: second, team2Id: third, status: 'ready' },
    });
  }
}

// ===== Helper: Advance Swiss playoff matches (SF → Final, 3rd) =====
async function advanceSwissPlayoff(
  tournamentId: string,
  match: { id: string; round: number; matchNumber: number; bracket: string; groupLabel: string | null },
  winnerId: string | null,
  loserId: string | null
) {
  const label = match.groupLabel;
  if (!label) return;

  if (label === 'SF1') {
    const finalMatch = await db.match.findFirst({ where: { tournamentId, groupLabel: 'Final' } });
    const thirdMatch = await db.match.findFirst({ where: { tournamentId, groupLabel: '3rd' } });

    if (finalMatch && winnerId) {
      await db.match.update({ where: { id: finalMatch.id }, data: { team1Id: winnerId } });
      const updated = await db.match.findUnique({ where: { id: finalMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: finalMatch.id }, data: { status: 'ready' } });
      }
    }
    if (thirdMatch && loserId) {
      await db.match.update({ where: { id: thirdMatch.id }, data: { team1Id: loserId } });
      const updated = await db.match.findUnique({ where: { id: thirdMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: thirdMatch.id }, data: { status: 'ready' } });
      }
    }
  } else if (label === 'SF2') {
    const finalMatch = await db.match.findFirst({ where: { tournamentId, groupLabel: 'Final' } });
    const thirdMatch = await db.match.findFirst({ where: { tournamentId, groupLabel: '3rd' } });

    if (finalMatch && winnerId) {
      await db.match.update({ where: { id: finalMatch.id }, data: { team2Id: winnerId } });
      const updated = await db.match.findUnique({ where: { id: finalMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: finalMatch.id }, data: { status: 'ready' } });
      }
    }
    if (thirdMatch && loserId) {
      await db.match.update({ where: { id: thirdMatch.id }, data: { team2Id: loserId } });
      const updated = await db.match.findUnique({ where: { id: thirdMatch.id } });
      if (updated?.team1Id && updated?.team2Id && updated.status === 'pending') {
        await db.match.update({ where: { id: thirdMatch.id }, data: { status: 'ready' } });
      }
    }
  }
  // Final and 3rd place matches — no further advancement
}

// ===== Helper: Check if all group matches done and seed playoffs =====
async function checkAndSeedPlayoffs(tournamentId: string) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.format !== 'group_stage') return;

  // Check if group matches are all completed
  const groupMatches = await db.match.findMany({
    where: { tournamentId, bracket: 'group' },
  });

  const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.status === 'completed');
  if (!allGroupDone) return;

  // Check if playoffs already seeded (look for new double-elim labels first, then old SF1)
  const u11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-1' } });
  if (u11?.team1Id) return; // Already seeded (new double elim)
  const sf1 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'SF1' } });
  if (sf1?.team1Id) return; // Already seeded (old single elim — backward compat)

  // Compute group standings
  const groupLabels = [...new Set(groupMatches.map(m => m.groupLabel))].sort() as string[];

  const standingsByGroup: Record<string, { teamId: string; wins: number; draws: number; losses: number; points: number; gameWins: number; gameLosses: number }[]> = {};

  for (const label of groupLabels) {
    const groupLabelMatches = groupMatches.filter(m => m.groupLabel === label);
    const teamMap = new Map<string, { teamId: string; wins: number; draws: number; losses: number; points: number; gameWins: number; gameLosses: number }>();

    for (const m of groupLabelMatches) {
      if (!m.team1Id || !m.team2Id) continue;
      const s1 = m.score1 ?? 0;
      const s2 = m.score2 ?? 0;

      if (!teamMap.has(m.team1Id)) teamMap.set(m.team1Id, { teamId: m.team1Id, wins: 0, draws: 0, losses: 0, points: 0, gameWins: 0, gameLosses: 0 });
      if (!teamMap.has(m.team2Id)) teamMap.set(m.team2Id, { teamId: m.team2Id, wins: 0, draws: 0, losses: 0, points: 0, gameWins: 0, gameLosses: 0 });

      const t1 = teamMap.get(m.team1Id)!;
      const t2 = teamMap.get(m.team2Id)!;

      t1.gameWins += s1; t1.gameLosses += s2;
      t2.gameWins += s2; t2.gameLosses += s1;

      if (s1 > s2) { t1.wins++; t1.points += 3; t2.losses++; }
      else if (s2 > s1) { t2.wins++; t2.points += 3; t1.losses++; }
      else { t1.draws++; t2.draws++; t1.points++; t2.points++; }
    }

    const sorted = Array.from(teamMap.values()).sort((a, b) =>
      b.points - a.points || b.wins - a.wins || (b.gameWins - b.gameLosses) - (a.gameWins - a.gameLosses)
    );
    standingsByGroup[label] = sorted;
  }

  const numGroups = groupLabels.length;

  if (numGroups === 1) {
    // Single group: 1st vs 4th (U1-1), 2nd vs 3rd (U1-2)
    // NEW FORMAT: Rank 3 → Lower L1-2 (team1), Rank 4 → Lower L1-1 (team1)
    const group = standingsByGroup[groupLabels[0]];
    if (group && group.length >= 4) {
      const u11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-1' } });
      if (u11) {
        await db.match.update({ where: { id: u11.id }, data: { team1Id: group[0].teamId, team2Id: group[3].teamId, status: 'ready' } });
      }
      const u12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-2' } });
      if (u12) {
        await db.match.update({ where: { id: u12.id }, data: { team1Id: group[1].teamId, team2Id: group[2].teamId, status: 'ready' } });
      }
      // Seed rank 3 and rank 4 into Lower Bracket L1
      // L1-1 team1 = rank 4 (faces U1-1 loser), L1-2 team1 = rank 3 (faces U1-2 loser)
      if (group.length >= 3) {
        const l12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-2' } });
        if (l12) {
          await db.match.update({ where: { id: l12.id }, data: { team1Id: group[2].teamId } });
        }
      }
      if (group.length >= 4) {
        const l11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-1' } });
        if (l11) {
          await db.match.update({ where: { id: l11.id }, data: { team1Id: group[3].teamId } });
        }
      }
    }
  } else if (numGroups === 2) {
    // 2 groups: A1 vs B2 (U1-1), B1 vs A2 (U1-2)
    // NEW FORMAT: A3 → Lower L1-1 (team1), B3 → Lower L1-2 (team1)
    const groupA = standingsByGroup[groupLabels[0]];
    const groupB = standingsByGroup[groupLabels[1]];

    if (groupA && groupB && groupA.length >= 2 && groupB.length >= 2) {
      const A1 = groupA[0].teamId;
      const A2 = groupA[1].teamId;
      const B1 = groupB[0].teamId;
      const B2 = groupB[1].teamId;

      const u11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-1' } });
      if (u11) {
        await db.match.update({ where: { id: u11.id }, data: { team1Id: A1, team2Id: B2, status: 'ready' } });
      }
      const u12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-2' } });
      if (u12) {
        await db.match.update({ where: { id: u12.id }, data: { team1Id: B1, team2Id: A2, status: 'ready' } });
      }
    }

    // Seed rank 3 into Lower Bracket — A3 → L1-1, B3 → L1-2
    if (groupA && groupA.length >= 3) {
      const l11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-1' } });
      if (l11) {
        await db.match.update({ where: { id: l11.id }, data: { team1Id: groupA[2].teamId } });
      }
    }
    if (groupB && groupB.length >= 3) {
      const l12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-2' } });
      if (l12) {
        await db.match.update({ where: { id: l12.id }, data: { team1Id: groupB[2].teamId } });
      }
    }
  } else if (numGroups === 3) {
    // 3 groups — Top of each group + best 2nd place
    // NEW FORMAT: Rank 3 from each group → Lower Bracket L1 (waiting)
    // Rank all 2nd place teams to find the best one
    const secondPlaceTeams = groupLabels
      .map(label => standingsByGroup[label]?.[1])
      .filter(Boolean)
      .sort((a, b) => (b?.points || 0) - (a?.points || 0) || (b?.wins || 0) - (a?.wins || 0));

    const best2nd = secondPlaceTeams[0];
    if (!best2nd) return;

    // Get the 3 group winners
    const groupWinners = groupLabels
      .map(label => ({ label, team: standingsByGroup[label]?.[0] }))
      .filter(Boolean);

    // Sort group winners by points for seeding
    groupWinners.sort((a, b) => (b.team?.points || 0) - (a.team?.points || 0));

    // U1-1: Best group winner vs Best 2nd place
    // U1-2: 2nd best group winner vs 3rd best group winner
    if (groupWinners.length >= 3 && best2nd) {
      const u11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-1' } });
      if (u11 && groupWinners[0].team) {
        await db.match.update({ where: { id: u11.id }, data: { team1Id: groupWinners[0].team.teamId, team2Id: best2nd.teamId, status: 'ready' } });
      }
      const u12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-2' } });
      if (u12 && groupWinners[1].team && groupWinners[2].team) {
        await db.match.update({ where: { id: u12.id }, data: { team1Id: groupWinners[1].team.teamId, team2Id: groupWinners[2].team.teamId, status: 'ready' } });
      }
    }

    // Seed rank 3 from each group into Lower Bracket L1
    // L1-1 team1 = rank 3 of group whose winner is in U1-1 (faces U1-1 loser)
    // L1-2 team1 = rank 3 of group whose winner is in U1-2 (faces U1-2 loser)
    const thirdPlaceTeams = groupLabels
      .map(label => ({ label, team: standingsByGroup[label]?.[2] }))
      .filter(g => g.team)
      .sort((a, b) => (b.team?.points || 0) - (a.team?.points || 0));

    if (thirdPlaceTeams.length >= 1) {
      const l11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-1' } });
      if (l11 && thirdPlaceTeams[0].team) {
        await db.match.update({ where: { id: l11.id }, data: { team1Id: thirdPlaceTeams[0].team.teamId } });
      }
    }
    if (thirdPlaceTeams.length >= 2) {
      const l12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-2' } });
      if (l12 && thirdPlaceTeams[1].team) {
        await db.match.update({ where: { id: l12.id }, data: { team1Id: thirdPlaceTeams[1].team.teamId } });
      }
    }
  } else if (numGroups === 4) {
    // 4 groups — Quarter-finals with cross-bracket (double elimination)
    // NEW FORMAT: Rank 3 from each group → Lower Bracket L1 (waiting for Upper QF losers)
    // U1-1: A1 vs D2, U1-2: B1 vs C2, U1-3: C1 vs B2, U1-4: D1 vs A2
    // L1-1: A3 (vs U1-1 loser), L1-2: B3 (vs U1-2 loser), L1-3: C3 (vs U1-3 loser), L1-4: D3 (vs U1-4 loser)
    const groupA = standingsByGroup['A'];
    const groupB = standingsByGroup['B'];
    const groupC = standingsByGroup['C'];
    const groupD = standingsByGroup['D'];

    if (groupA?.[0] && groupD?.[1]) {
      const u11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-1' } });
      if (u11) await db.match.update({ where: { id: u11.id }, data: { team1Id: groupA[0].teamId, team2Id: groupD[1].teamId, status: 'ready' } });
    }
    if (groupB?.[0] && groupC?.[1]) {
      const u12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-2' } });
      if (u12) await db.match.update({ where: { id: u12.id }, data: { team1Id: groupB[0].teamId, team2Id: groupC[1].teamId, status: 'ready' } });
    }
    if (groupC?.[0] && groupB?.[1]) {
      const u13 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-3' } });
      if (u13) await db.match.update({ where: { id: u13.id }, data: { team1Id: groupC[0].teamId, team2Id: groupB[1].teamId, status: 'ready' } });
    }
    if (groupD?.[0] && groupA?.[1]) {
      const u14 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'U1-4' } });
      if (u14) await db.match.update({ where: { id: u14.id }, data: { team1Id: groupD[0].teamId, team2Id: groupA[1].teamId, status: 'ready' } });
    }

    // Seed rank 3 into Lower Bracket L1 (facing corresponding Upper QF loser)
    if (groupA?.[2]) {
      const l11 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-1' } });
      if (l11) await db.match.update({ where: { id: l11.id }, data: { team1Id: groupA[2].teamId } });
    }
    if (groupB?.[2]) {
      const l12 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-2' } });
      if (l12) await db.match.update({ where: { id: l12.id }, data: { team1Id: groupB[2].teamId } });
    }
    if (groupC?.[2]) {
      const l13 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-3' } });
      if (l13) await db.match.update({ where: { id: l13.id }, data: { team1Id: groupC[2].teamId } });
    }
    if (groupD?.[2]) {
      const l14 = await db.match.findFirst({ where: { tournamentId, groupLabel: 'L1-4' } });
      if (l14) await db.match.update({ where: { id: l14.id }, data: { team1Id: groupD[2].teamId } });
    }
  } else {
    // 5+ groups — Generic playoff seeding into double elimination bracket
    // NEW FORMAT: Rank 1&2 → Upper, Rank 3 → Lower L1 (waiting for upper losers)
    const playoffSize = Math.pow(2, Math.ceil(Math.log2(numGroups)));
    const wildcardsNeeded = playoffSize - numGroups;

    // Collect all group winners (seeded by points)
    const groupWinners = groupLabels
      .map(label => ({ label, standing: standingsByGroup[label]?.[0] }))
      .filter(g => g.standing)
      .sort((a, b) => (b.standing?.points || 0) - (a.standing?.points || 0));

    // Collect all 2nd place teams for wildcards (sorted by points)
    const secondPlaceTeams = groupLabels
      .map(label => ({ label, standing: standingsByGroup[label]?.[1] }))
      .filter(g => g.standing)
      .sort((a, b) => (b.standing?.points || 0) - (a.standing?.points || 0));

    // Combine: group winners first, then best 2nd places
    const playoffTeams = [
      ...groupWinners.map(g => g.standing!.teamId),
      ...secondPlaceTeams.slice(0, wildcardsNeeded).map(g => g.standing!.teamId),
    ];

    // Seed into first playoff round matches using U1-N labels
    const firstRoundMatches = await db.match.findMany({
      where: { tournamentId, round: 2, bracket: 'upper' },
      orderBy: { matchNumber: 'asc' },
    });

    for (let i = 0; i < firstRoundMatches.length; i++) {
      const team1Id = playoffTeams[i * 2] || null;
      const team2Id = playoffTeams[i * 2 + 1] || null;

      if (team1Id && team2Id) {
        await db.match.update({
          where: { id: firstRoundMatches[i].id },
          data: { team1Id, team2Id, status: 'ready' },
        });
      } else if (team1Id) {
        await db.match.update({
          where: { id: firstRoundMatches[i].id },
          data: { team1Id, status: 'pending' },
        });
      }
    }

    // Seed rank 3 from each group into Lower Bracket L1 (team1 pre-seeded, team2 = upper loser TBD)
    const thirdPlaceTeams = groupLabels
      .map(label => ({ label, standing: standingsByGroup[label]?.[2] }))
      .filter(g => g.standing)
      .sort((a, b) => (b.standing?.points || 0) - (a.standing?.points || 0));

    const l1Matches = await db.match.findMany({
      where: { tournamentId, groupLabel: { startsWith: 'L1-' } },
      orderBy: { matchNumber: 'asc' },
    });

    for (let i = 0; i < Math.min(l1Matches.length, thirdPlaceTeams.length); i++) {
      if (thirdPlaceTeams[i].standing) {
        await db.match.update({
          where: { id: l1Matches[i].id },
          data: { team1Id: thirdPlaceTeams[i].standing!.teamId },
        });
      }
    }
  }
}

// ===== Helper: Check if all matches complete → auto advance =====
async function checkAllMatchesComplete(tournamentId: string) {
  // Only count matches that have both teams assigned as "incomplete"
  // Matches with null teams are unfilled bracket slots and shouldn't block progression
  const playableIncomplete = await db.match.count({
    where: {
      tournamentId,
      status: { in: ['pending', 'ready', 'live'] },
      team1Id: { not: null },
      team2Id: { not: null },
    },
  });

  // Also check if there are any completed matches at all
  const completedCount = await db.match.count({
    where: { tournamentId, status: 'completed' },
  });

  if (playableIncomplete === 0 && completedCount > 0) {
    await db.tournament.update({ where: { id: tournamentId }, data: { status: 'finalization' } });
  } else {
    const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
    if (tournament?.status === 'bracket_generation') {
      await db.tournament.update({ where: { id: tournamentId }, data: { status: 'main_event' } });
    }
  }
}

// ===== UNDO SCORE (Bug #7 fix) =====
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { matchId } = body;

  if (!matchId) {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  }

  try {
    // Collect club stats reversals to apply AFTER the transaction
    const clubStatsQueue: { playerId: string; type: 'win' | 'loss' | 'draw'; gameDiff: number }[] = [];
    let tournamentDivision = '';
    let tournamentSeasonId = '';

    // Neon workaround: $transaction() doesn't work with PrismaNeonHttp
    const result = await neonTransaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          tournament: { select: { id: true, division: true, seasonId: true, format: true, name: true } },
          team1: { include: { teamPlayers: { include: { player: true } } } },
          team2: { include: { teamPlayers: { include: { player: true } } } },
          winner: true,
          loser: true,
        },
      });

      if (!match) throw new Error('Match not found');
      if (match.tournamentId !== id) throw new Error('Match does not belong to this tournament');
      if (match.status !== 'completed') throw new Error('Match is not completed');

      tournamentDivision = match.tournament.division;
      tournamentSeasonId = match.tournament.seasonId;

      const gameDiff = Math.abs((match.score1 || 0) - (match.score2 || 0));

      // Reverse club stats BEFORE resetting match (within transaction for consistency)
      if (match.winnerId && match.loserId) {
        const winningTeam = match.team1Id === match.winnerId ? match.team1! : match.team2!;
        const losingTeam = match.team1Id === match.loserId ? match.team1! : match.team2!;

        for (const tp of winningTeam.teamPlayers) {
          clubStatsQueue.push({ playerId: tp.playerId, type: 'win', gameDiff: -gameDiff });
        }
        for (const tp of losingTeam.teamPlayers) {
          clubStatsQueue.push({ playerId: tp.playerId, type: 'loss', gameDiff: gameDiff });
        }
      } else if (match.score1 === match.score2) {
        // Draw reversal
        for (const team of [match.team1!, match.team2!]) {
          for (const tp of team.teamPlayers) {
            clubStatsQueue.push({ playerId: tp.playerId, type: 'draw', gameDiff: 0 });
          }
        }
      }

      // Reverse points from PlayerPoint records
      const pointRecords = await tx.playerPoint.findMany({
        where: { matchId, tournamentId: id },
      });

      const pointsByPlayer = new Map<string, number>();
      for (const pr of pointRecords) {
        pointsByPlayer.set(pr.playerId, (pointsByPlayer.get(pr.playerId) || 0) + pr.amount);
      }

      for (const [playerId, totalPts] of pointsByPlayer) {
        // Neon workaround: updateMany() doesn't work with PrismaNeonHttp
        // Since this targets a single player by ID, we can use update() instead
        await tx.player.update({
          where: { id: playerId },
          data: { points: { decrement: totalPts } },
        });
      }

      // Reverse player stats
      if (match.winnerId && match.team1 && match.team2) {
        const winningTeam = match.team1Id === match.winnerId ? match.team1 : match.team2;
        const losingTeam = match.team1Id === match.loserId ? match.team1 : match.team2;

        for (const tp of winningTeam.teamPlayers) {
          await tx.player.update({
            where: { id: tp.playerId },
            data: {
              totalWins: { decrement: 1 },
              matches: { decrement: 1 },
              streak: 0,
            },
          });
        }
        if (losingTeam) {
          for (const tp of losingTeam.teamPlayers) {
            await tx.player.update({
              where: { id: tp.playerId },
              data: {
                matches: { decrement: 1 },
                streak: 0,
              },
            });
          }
        }
      }

      // Delete PlayerPoint records
      // Pass tx so delete runs WITHIN the transaction (fixes "Transaction not found" error)
      if (isPostgreSQL) {
        await neonDeleteMany('PlayerPoint',
          [{ column: 'matchId', operator: '=', value: matchId }, { column: 'tournamentId', operator: '=', value: id }],
          tx,
        );
      } else {
        await tx.playerPoint.deleteMany({ where: { matchId, tournamentId: id } });
      }

      // Reverse participation points
      const participations = await tx.participation.findMany({
        where: { tournamentId: id },
      });

      for (const p of participations) {
        const pts = pointsByPlayer.get(p.playerId) || 0;
        if (pts > 0) {
          await tx.participation.update({
            where: { id: p.id },
            data: { pointsEarned: Math.max(0, p.pointsEarned - pts) },
          });
        }
      }

      // Reset match
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          score1: null,
          score2: null,
          status: 'ready',
          winnerId: null,
          loserId: null,
          completedAt: null,
        },
      });

      // Clear the advanced team from next round matches
      // Find matches in later rounds that might have this team
      const laterMatches = await tx.match.findMany({
        where: {
          tournamentId: id,
          status: { in: ['pending', 'ready'] },
          bracket: { in: ['upper', 'lower', 'grand_final'] },
        },
      });

      for (const lm of laterMatches) {
        const updates: Record<string, unknown> = {};
        if (lm.team1Id && (lm.team1Id === match.winnerId || lm.team1Id === match.loserId)) {
          updates.team1Id = null;
        }
        if (lm.team2Id && (lm.team2Id === match.winnerId || lm.team2Id === match.loserId)) {
          updates.team2Id = null;
        }
        if (Object.keys(updates).length > 0) {
          await tx.match.update({
            where: { id: lm.id },
            data: { ...updates, status: 'pending' },
          });
        }
      }

      return { updatedMatch, match };
    });

    // ===== CLUB STATS REVERSAL (outside transaction to keep transactions short) =====
    if (clubStatsQueue.length > 0 && tournamentDivision && tournamentSeasonId) {
      for (const { playerId, type, gameDiff } of clubStatsQueue) {
        // Reverse the club stats by applying the opposite
        if (type === 'win') {
          // Undo win: decrement wins and points
          await updateClubStatsForPlayer(playerId, tournamentDivision, tournamentSeasonId, 'loss', gameDiff);
        } else if (type === 'loss') {
          // Undo loss: decrement losses (add a win with negative diff to effectively reverse)
          await updateClubStatsForPlayer(playerId, tournamentDivision, tournamentSeasonId, 'win', gameDiff);
        } else {
          // Undo draw: decrement points
          try {
            const membership = await db.clubMember.findFirst({
              where: {
                playerId,
                leftAt: null,
                profile: { seasonEntries: { some: { division: tournamentDivision, seasonId: tournamentSeasonId } } },
              },
              include: { profile: { include: { seasonEntries: { where: { division: tournamentDivision, seasonId: tournamentSeasonId } } } } },
            });
            if (membership?.profile.seasonEntries[0]) {
              await db.club.update({
                where: { id: membership.profile.seasonEntries[0].id },
                data: { points: { decrement: 1 } },
              });
            }
          } catch (e) {
            console.error('Club stats draw reversal failed (non-critical):', e);
          }
        }
      }
    }

    // Check if tournament should revert from finalization
    const tournament = await db.tournament.findUnique({ where: { id } });
    if (tournament?.status === 'finalization') {
      const playableIncomplete = await db.match.count({
        where: {
          tournamentId: id,
          status: { in: ['pending', 'ready', 'live'] },
          team1Id: { not: null },
          team2Id: { not: null },
        },
      });
      if (playableIncomplete > 0) {
        await db.tournament.update({ where: { id }, data: { status: 'main_event' } });
      }
    }

    return NextResponse.json(result.updatedMatch);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Undo score error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
