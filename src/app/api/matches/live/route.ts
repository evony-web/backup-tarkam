import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/matches/live?division=male|female
 * Returns currently live matches with team names, scores, and power ratings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division'); // 'male' | 'female' | null (all)

    const matchStatuses = ['live', 'main_event'];

    const matchWhere: any = {
      status: { in: matchStatuses },
    };

    if (division) {
      matchWhere.tournament = { division };
    }

    const liveMatches = await db.match.findMany({
      where: matchWhere,
      include: {
        team1: {
          select: {
            id: true,
            name: true,
            power: true,
            isWinner: true,
            teamPlayers: {
              select: {
                player: {
                  select: { id: true, gamertag: true, tier: true },
                },
              },
            },
          },
        },
        team2: {
          select: {
            id: true,
            name: true,
            power: true,
            isWinner: true,
            teamPlayers: {
              select: {
                player: {
                  select: { id: true, gamertag: true, tier: true },
                },
              },
            },
          },
        },
        mvpPlayer: {
          select: { id: true, gamertag: true },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            weekNumber: true,
            division: true,
            format: true,
            season: {
              select: { id: true, name: true, number: true },
            },
          },
        },
      },
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
    });

    return NextResponse.json({
      matches: liveMatches,
      count: liveMatches.length,
      hasLive: liveMatches.length > 0,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
      },
    });
  } catch {
    return NextResponse.json({
      matches: [],
      count: 0,
      hasLive: false,
    });
  }
}
