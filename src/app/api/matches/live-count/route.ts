import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/matches/live-count?division=male|female|semua
 * Returns live match counts: activeTournaments, completedMatches, upcomingMatches, liveNow
 * If division is specified, filters by division (via tournament → season relation)
 * If division is "semua", returns all divisions (no filter)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDivision = searchParams.get('division'); // 'male' | 'female' | 'semua' | null (all)
    // "semua" means query both divisions — treat same as null (no filter)
    const division = rawDivision === 'semua' ? null : rawDivision;

    // Base filter: if division specified, filter tournaments by division
    const tournamentWhere = division
      ? {
          division,
          status: { in: ['registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization'] },
        }
      : {
          status: { in: ['registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization'] },
        };

    // Count active (non-completed) tournaments
    const activeTournaments = await db.tournament.count({
      where: tournamentWhere,
    });

    // For match counts, we need to filter by tournament division
    // Match → Tournament → division
    const matchWhereCompleted = division
      ? { status: 'completed' as const, tournament: { division } }
      : { status: 'completed' as const };

    const matchWhereUpcoming = division
      ? { status: { in: ['pending', 'ready'] as string[] }, tournament: { division } }
      : { status: { in: ['pending', 'ready'] as string[] } };

    // Count completed matches (Match model)
    const completedMatches = await db.match.count({
      where: matchWhereCompleted,
    });

    // Count upcoming matches (Match model)
    const upcomingMatches = await db.match.count({
      where: matchWhereUpcoming,
    });

    // Check if any matches are live right now
    const liveMatchCount = await db.match.count({
      where: division
        ? { status: 'live', tournament: { division } }
        : { status: 'live' },
    });

    const liveNow = liveMatchCount > 0;

    return NextResponse.json({
      activeTournaments,
      completedMatches,
      upcomingMatches,
      liveNow,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        'Surrogate-Key': 'league-data',
      },
    });
  } catch {
    return NextResponse.json({
      activeTournaments: 0,
      completedMatches: 0,
      upcomingMatches: 0,
      liveNow: false,
    });
  }
}
