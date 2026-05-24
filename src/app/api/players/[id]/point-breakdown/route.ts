import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/players/[id]/point-breakdown
 *
 * Returns a detailed breakdown of the player's points grouped by reason.
 * Used by the player profile modal to show "Rincian Poin".
 *
 * Point sources (only 3):
 * - match_win: +1 pt per win (all formats)
 * - streak_bonus: +2 pts per 3 consecutive wins (all formats)
 * - prize_juara1/2/3, prize_mvp: points from TournamentPrize
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');

  const { id } = await params;

  const player = await db.player.findUnique({
    where: { id },
    select: { id: true, gamertag: true, points: true, totalWins: true, streak: true, maxStreak: true, matches: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404, headers });
  }

  // Get all point records for this player, grouped by reason
  const pointRecords = await db.playerPoint.findMany({
    where: { playerId: id },
    select: { reason: true, amount: true, tournamentId: true },
  });

  // Aggregate by reason
  const breakdown: Record<string, number> = {};
  for (const record of pointRecords) {
    breakdown[record.reason] = (breakdown[record.reason] || 0) + record.amount;
  }

  // Categorize into the 3 main point sources
  const matchWinPoints = breakdown['match_win'] || 0;
  const streakBonusPoints = breakdown['streak_bonus'] || 0;
  const prizePoints =
    (breakdown['prize_juara1'] || 0) +
    (breakdown['prize_juara2'] || 0) +
    (breakdown['prize_juara3'] || 0) +
    (breakdown['prize_mvp'] || 0) +
    (breakdown['prize_other'] || 0);

  // Other legacy points that may exist from old system (for transparency)
  const otherPoints = Object.entries(breakdown)
    .filter(([reason]) => !['match_win', 'streak_bonus', 'prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other'].includes(reason))
    .reduce((sum, [, amount]) => sum + amount, 0);

  // Detailed prize breakdown (total)
  const prizeDetail = {
    juara1: breakdown['prize_juara1'] || 0,
    juara2: breakdown['prize_juara2'] || 0,
    juara3: breakdown['prize_juara3'] || 0,
    mvp: breakdown['prize_mvp'] || 0,
    other: breakdown['prize_other'] || 0,
  };

  // ═══ Per-tournament prize breakdown ═══
  // Group prize points by tournamentId for week-level detail
  const prizeReasons = new Set(['prize_juara1', 'prize_juara2', 'prize_juara3', 'prize_mvp', 'prize_other']);
  const tournamentPrizeMap = new Map<string, Array<{ reason: string; amount: number }>>();

  for (const record of pointRecords) {
    if (prizeReasons.has(record.reason) && record.tournamentId) {
      if (!tournamentPrizeMap.has(record.tournamentId)) {
        tournamentPrizeMap.set(record.tournamentId, []);
      }
      tournamentPrizeMap.get(record.tournamentId)!.push({ reason: record.reason, amount: record.amount });
    }
  }

  // Fetch tournament names + week numbers for the prize details
  const prizeByWeek: Array<{ week: number; label: string; juara1: number; juara2: number; juara3: number; mvp: number }> = [];

  if (tournamentPrizeMap.size > 0) {
    const tournamentIds = Array.from(tournamentPrizeMap.keys());
    const tournaments = await db.tournament.findMany({
      where: { id: { in: tournamentIds } },
      select: { id: true, name: true, weekNumber: true },
    });
    const tournamentMap = new Map(tournaments.map(t => [t.id, t]));

    for (const [tid, prizes] of tournamentPrizeMap) {
      const t = tournamentMap.get(tid);
      if (!t) continue;
      const entry: typeof prizeByWeek[number] = { week: t.weekNumber, label: t.name, juara1: 0, juara2: 0, juara3: 0, mvp: 0 };
      for (const p of prizes) {
        if (p.reason === 'prize_juara1') entry.juara1 += p.amount;
        else if (p.reason === 'prize_juara2') entry.juara2 += p.amount;
        else if (p.reason === 'prize_juara3') entry.juara3 += p.amount;
        else if (p.reason === 'prize_mvp') entry.mvp += p.amount;
      }
      prizeByWeek.push(entry);
    }

    // Sort by week ascending
    prizeByWeek.sort((a, b) => a.week - b.week);
  }

  const totalCalculated = matchWinPoints + streakBonusPoints + prizePoints + otherPoints;

  return NextResponse.json({
    playerId: player.id,
    gamertag: player.gamertag,
    totalPoints: totalCalculated,
    totalWins: player.totalWins,
    streak: player.streak,
    maxStreak: player.maxStreak,
    matches: player.matches,
    breakdown: {
      matchWin: matchWinPoints,
      streakBonus: streakBonusPoints,
      prize: prizePoints,
      other: otherPoints,
    },
    prizeDetail,
    prizeByWeek,
    totalCalculated,
    diff: player.points - totalCalculated, // Should be 0 if data is consistent
  }, { headers });
}
