import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/players/leaderboard
 *
 * Query params:
 *   division: "male" | "female" | "semua"
 *   seasonId: string — if provided, compute per-season points
 *   limit: number — max results (default 50)
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const rawDivision = searchParams.get('division');
  const divisionFilter = rawDivision === 'semua' ? { in: ['male', 'female'] } : rawDivision;
  const seasonId = searchParams.get('seasonId');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (seasonId) {
    // ===== PER-SEASON LEADERBOARD =====
    const seasonPointsRaw = await db.playerPoint.groupBy({
      by: ['playerId'],
      where: { seasonId },
      _sum: { amount: true },
    });

    const playerIds = seasonPointsRaw.map(sp => sp.playerId);
    const where: Record<string, unknown> = { id: { in: playerIds }, isActive: true, registrationStatus: 'approved' };
    if (divisionFilter) where.division = divisionFilter;

    const players = await db.player.findMany({
      where,
      include: {
        clubMembers: {
          where: { leftAt: null },
          include: {
            profile: {
              select: { name: true },
            },
          },
        },
      },
    });

    const playerMap = new Map(players.map(p => [p.id, p]));
    const seasonPointMap = new Map(seasonPointsRaw.map(sp => [sp.playerId, sp._sum.amount || 0]));

    const leaderboard = players
      .map(p => {
        const sp = seasonPointMap.get(p.id) || 0;
        const club = (p.clubMembers as unknown as { profile: { name: string } }[] | undefined)?.[0]?.profile?.name || null;
        return {
          id: p.id,
          name: p.name,
          gamertag: p.gamertag,
          tier: p.tier,
          avatar: p.avatar,
          points: sp, // Per-season points
          seasonPoints: sp,
          lifetimePoints: p.points,
          totalWins: p.totalWins,
          totalMvp: p.totalMvp,
          streak: p.streak,
          maxStreak: p.maxStreak,
          matches: p.matches,
          club,
        };
      })
      .sort((a, b) => {
        if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        return b.maxStreak - a.maxStreak;
      })
      .slice(0, limit)
      .map((p, idx) => ({ rank: idx + 1, ...p }));

    return NextResponse.json(leaderboard, { headers });
  }

  // ===== LIFETIME LEADERBOARD (fallback) =====
  const where: Record<string, unknown> = { isActive: true, registrationStatus: 'approved' };
  if (divisionFilter) where.division = divisionFilter;

  const players = await db.player.findMany({
    where,
    orderBy: [{ points: 'desc' }, { totalWins: 'desc' }, { maxStreak: 'desc' }],
    take: limit,
    include: {
      clubMembers: {
        where: { leftAt: null },
        include: {
          profile: {
            select: { name: true },
            ...(seasonId ? { seasonEntries: { where: { seasonId }, select: { id: true } } } : {}),
          },
        },
      },
    },
  });

  const leaderboard = players.map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    name: p.name,
    gamertag: p.gamertag,
    tier: p.tier,
    avatar: p.avatar,
    points: p.points,
    totalWins: p.totalWins,
    totalMvp: p.totalMvp,
    streak: p.streak,
    maxStreak: p.maxStreak,
    matches: p.matches,
    club: (p.clubMembers as unknown as { profile: { name: string } }[] | undefined)?.[0]?.profile?.name || null,
  }));

  return NextResponse.json(leaderboard, { headers });
}
