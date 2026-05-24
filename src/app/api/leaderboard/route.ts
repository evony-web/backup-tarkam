import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/leaderboard
 *
 * Query params:
 *   division: "male" | "female" — filter by division
 *   seasonId: string — if provided, compute per-season points from PlayerPoint aggregation
 *   limit: number — max results (default 50)
 *
 * When seasonId is provided, points are computed from PlayerPoint records for that season.
 * When seasonId is not provided, falls back to lifetime Player.points.
 */
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division');
    const seasonId = searchParams.get('seasonId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (seasonId) {
      // ===== PER-SEASON LEADERBOARD =====
      // Compute points from PlayerPoint records for this season
      const season = await db.season.findUnique({
        where: { id: seasonId },
        select: { id: true, division: true, status: true },
      });

      if (!season) {
        return NextResponse.json(
          { success: false, error: 'Season tidak ditemukan' },
          { headers,  status: 404 }
        );
      }

      // Aggregate per-season points from PlayerPoint records
      const seasonPointsRaw = await db.playerPoint.groupBy({
        by: ['playerId'],
        where: { seasonId },
        _sum: { amount: true },
      });

      // Get player details
      const playerIds = seasonPointsRaw.map(sp => sp.playerId);
      const divisionFilter = division || season.division;
      const players = await db.player.findMany({
        where: {
          id: { in: playerIds },
          isActive: true,
          registrationStatus: 'approved',
          ...(divisionFilter && divisionFilter !== 'liga' ? { division: divisionFilter } : {}),
        },
        select: {
          id: true,
          name: true,
          gamertag: true,
          avatar: true,
          tier: true,
          points: true,
          totalWins: true,
          totalMvp: true,
          streak: true,
          maxStreak: true,
          division: true,
          matches: true,
        },
      });

      const playerMap = new Map(players.map(p => [p.id, p]));

      // Build leaderboard with per-season points
      const leaderboard = seasonPointsRaw
        .map(sp => {
          const player = playerMap.get(sp.playerId);
          if (!player) return null;
          return {
            ...player,
            points: sp._sum.amount || 0, // Override lifetime points with per-season points
            seasonPoints: sp._sum.amount || 0,
            lifetimePoints: player.points,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          // Sort by per-season points desc, then totalWins desc, then totalMvp desc
          const ptsA = a!.seasonPoints;
          const ptsB = b!.seasonPoints;
          if (ptsB !== ptsA) return ptsB - ptsA;
          if (b!.totalWins !== a!.totalWins) return b!.totalWins - a!.totalWins;
          return b!.totalMvp - a!.totalMvp;
        })
        .slice(0, limit)
        .map((player, index) => ({
          ...player,
          rank: index + 1,
        }));

      return NextResponse.json({
        success: true,
        data: leaderboard,
        meta: {
          seasonId,
          division: divisionFilter,
          mode: 'per-season',
        },
      }, { headers });
    }

    // ===== LIFETIME LEADERBOARD (default / fallback) =====
    const where: Record<string, unknown> = {
      isActive: true,
      registrationStatus: 'approved',
    };

    if (division) {
      where.division = division;
    }

    const leaderboard = await db.player.findMany({
      where,
      select: {
        id: true,
        name: true,
        gamertag: true,
        avatar: true,
        tier: true,
        points: true,
        totalWins: true,
        totalMvp: true,
        streak: true,
        maxStreak: true,
        division: true,
        matches: true,
      },
      orderBy: [
        { points: 'desc' },
        { totalWins: 'desc' },
        { totalMvp: 'desc' },
      ],
      take: limit,
    });

    // Add rank
    const rankedLeaderboard = leaderboard.map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

    return NextResponse.json({
      success: true,
      data: rankedLeaderboard,
      meta: {
        division: division || null,
        mode: 'lifetime',
      },
    }, { headers });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { headers,  status: 500 }
    );
  }
}
