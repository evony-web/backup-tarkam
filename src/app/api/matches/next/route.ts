import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/matches/next?division=male|female|semua
 * Returns live match count, next upcoming match, and recent results (last 5)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDivision = searchParams.get('division') || 'male';
    const divisionFilter = rawDivision === 'semua' ? { in: ['male', 'female'] } : rawDivision;

    // Run all queries in parallel
    const [
      liveMatchCount,
      nextUpcomingMatch,
      recentCompletedMatches,
    ] = await Promise.all([
      // Count live tournament bracket matches
      db.match.count({
        where: { status: 'live' },
      }),

      // Next upcoming tournament match (earliest scheduledAt that's in the future)
      db.match.findFirst({
        where: {
          status: { in: ['pending', 'ready'] },
          scheduledAt: { gte: new Date() },
          tournament: { division: divisionFilter },
        },
        orderBy: { scheduledAt: 'asc' },
        include: {
          team1: { select: { name: true } },
          team2: { select: { name: true } },
          tournament: { select: { name: true } },
        },
      }),

      // Recent 5 completed tournament bracket matches
      // Only show matches from tournaments in main_event or later status
      db.match.findMany({
        where: {
          status: 'completed',
          tournament: { division: divisionFilter, status: { in: ['main_event', 'finalization', 'completed'] } },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: {
          team1: { select: { name: true } },
          team2: { select: { name: true } },
          tournament: { select: { name: true } },
        },
      }),
    ]);

    const liveCount = liveMatchCount;

    // Format next upcoming match
    const nextMatch = nextUpcomingMatch
      ? {
          id: nextUpcomingMatch.id,
          player1: nextUpcomingMatch.team1?.name || 'TBD',
          player2: nextUpcomingMatch.team2?.name || 'TBD',
          scheduledAt: nextUpcomingMatch.scheduledAt?.toISOString() || null,
          tournamentName: nextUpcomingMatch.tournament?.name || '',
        }
      : null;

    // Format recent results from bracket matches
    const recentResults: Array<{
      id: string;
      player1: string;
      player2: string;
      score: string;
      winnerId: string | null;
      completedAt: string;
    }> = [];

    for (const m of recentCompletedMatches) {
      const s1 = m.score1 ?? 0;
      const s2 = m.score2 ?? 0;
      recentResults.push({
        id: m.id,
        player1: m.team1?.name || 'TBD',
        player2: m.team2?.name || 'TBD',
        score: `${s1}-${s2}`,
        winnerId: m.winnerId,
        completedAt: m.completedAt?.toISOString() || m.createdAt.toISOString(),
      });
    }

    // Sort by completedAt desc and take top 5
    recentResults.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    const limitedResults = recentResults.slice(0, 5);

    return NextResponse.json(
      { liveCount, nextMatch, recentResults: limitedResults },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
          'Surrogate-Key': 'league-data',
          'Vary': 'Accept-Encoding',
        },
      }
    );
  } catch {
    return NextResponse.json({
      liveCount: 0,
      nextMatch: null,
      recentResults: [],
    });
  }
}
