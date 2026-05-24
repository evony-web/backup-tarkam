import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/rankings/[playerId]
 * Returns detailed point history for a specific player
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { playerId } = await params;

  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      participations: {
        include: { tournament: { select: { name: true, weekNumber: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { headers,  status: 404 });
  }

  // Query PlayerPoint separately to avoid Prisma client caching issues
  const pointRecords = await db.playerPoint.findMany({
    where: { playerId },
    orderBy: { createdAt: 'desc' },
    include: {
      tournament: { select: { name: true, weekNumber: true } },
      match: { select: { round: true, matchNumber: true, bracket: true } },
    },
  });

  // Point breakdown by reason
  const breakdown: Record<string, number> = {};
  for (const record of pointRecords) {
    breakdown[record.reason] = (breakdown[record.reason] || 0) + record.amount;
  }

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      gamertag: player.gamertag,
      tier: player.tier,
      points: player.points,
      totalWins: player.totalWins,
      totalMvp: player.totalMvp,
      streak: player.streak,
      maxStreak: player.maxStreak,
      matches: player.matches,
    },
    pointRecords,
    breakdown,
    tournamentHistory: player.participations,
  }, { headers });
}
