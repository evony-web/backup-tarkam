import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDivision = searchParams.get('division') || 'male';
    const divisionFilter = rawDivision === 'semua' ? { in: ['male', 'female'] } : rawDivision;
    const bracketFilter = searchParams.get('bracket') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20);

    // Get recent completed matches with team/player info
    const matches = await db.match.findMany({
      where: {
        status: 'completed',
        tournament: { division: divisionFilter },
        ...(bracketFilter ? { bracket: bracketFilter } : {}),
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        team1: {
          include: {
            teamPlayers: {
              include: {
                player: {
                  select: { id: true, gamertag: true, avatar: true, tier: true },
                },
              },
            },
          },
        },
        team2: {
          include: {
            teamPlayers: {
              include: {
                player: {
                  select: { id: true, gamertag: true, avatar: true, tier: true },
                },
              },
            },
          },
        },
        winner: { select: { id: true, name: true } },
        mvpPlayer: {
          select: { id: true, gamertag: true, avatar: true, tier: true },
        },
        tournament: {
          select: { name: true, weekNumber: true, division: true },
        },
      },
    });

    const recentMatches = matches.map((match) => ({
      id: match.id,
      tournamentName: match.tournament.name,
      weekNumber: match.tournament.weekNumber,
      team1: {
        id: match.team1?.id,
        name: match.team1?.name || 'TBD',
        score: match.score1,
        players: match.team1?.teamPlayers.map((tp) => ({
          id: tp.player.id,
          gamertag: tp.player.gamertag,
          avatar: tp.player.avatar,
          tier: tp.player.tier,
        })) || [],
      },
      team2: {
        id: match.team2?.id,
        name: match.team2?.name || 'TBD',
        score: match.score2,
        players: match.team2?.teamPlayers.map((tp) => ({
          id: tp.player.id,
          gamertag: tp.player.gamertag,
          avatar: tp.player.avatar,
          tier: tp.player.tier,
        })) || [],
      },
      winnerId: match.winnerId,
      winnerName: match.winner?.name || null,
      mvpPlayer: match.mvpPlayer ? {
        id: match.mvpPlayer.id,
        gamertag: match.mvpPlayer.gamertag,
        avatar: match.mvpPlayer.avatar,
        tier: match.mvpPlayer.tier,
      } : null,
      completedAt: match.completedAt?.toISOString() || null,
      format: match.format,
      bracket: match.bracket,
      division: match.tournament.division,
    }));

    const response = NextResponse.json({ matches: recentMatches });
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    response.headers.set('Surrogate-Key', 'league-data');
    return response;
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Error fetching recent matches:', error);
    return NextResponse.json({ matches: [] }, { status: 500 });
  }
}
