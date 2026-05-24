import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  const { id } = await params;

  const player = await db.player.findUnique({
    where: { id },
    select: { id: true, gamertag: true, division: true, tier: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404, headers });
  }

  // Get all season stats for this player
  const seasonStats = await db.playerSeasonStats.findMany({
    where: { playerId: id },
    include: {
      season: {
        select: {
          id: true,
          name: true,
          number: true,
          division: true,
          status: true,
          startDate: true,
          endDate: true,
          championPlayer: { select: { id: true, gamertag: true, avatar: true } },
          championPlayerPoints: true,
        },
      },
    },
    orderBy: { season: { number: 'desc' } },
  });

  // Get current club membership
  const currentClub = await db.clubMember.findFirst({
    where: { playerId: id, leftAt: null },
    include: { profile: { select: { name: true, logo: true } } },
  });

  const result = seasonStats.map(stat => ({
    seasonId: stat.season.id,
    seasonName: stat.season.name,
    seasonNumber: stat.season.number,
    seasonStatus: stat.season.status,
    division: stat.division,
    points: stat.points,
    totalWins: stat.totalWins,
    totalMvp: stat.totalMvp,
    streak: stat.streak,
    maxStreak: stat.maxStreak,
    matches: stat.matches,
    rank: stat.rank,
    tier: stat.tier,
    champion: stat.season.championPlayer,
    championPoints: stat.season.championPlayerPoints,
    startDate: stat.season.startDate,
    endDate: stat.season.endDate,
  }));

  return NextResponse.json({
    player: {
      id: player.id,
      gamertag: player.gamertag,
      division: player.division,
      currentTier: player.tier,
      currentClub: currentClub?.profile?.name || null,
    },
    seasons: result,
  }, { headers });
}
