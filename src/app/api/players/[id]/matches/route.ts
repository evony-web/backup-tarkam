import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Surrogate-Key': 'player-matches',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { id } = await params;

    // 1. Find the player by ID
    const player = await db.player.findUnique({
      where: { id },
      select: {
        id: true,
        gamertag: true,
        division: true,
        tier: true,
        clubMembers: {
          where: { leftAt: null },
          include: {
            profile: {
              select: { id: true, name: true, logo: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { headers, status: 404 });
    }

    const clubProfile = player.clubMembers[0]?.profile ?? null;

    // 2. Find tournament matches — via team memberships
    const teamPlayers = await db.teamPlayer.findMany({
      where: { playerId: id },
      include: { team: true },
    });

    const teamIds = teamPlayers.map((tp) => tp.teamId);

    let tournamentMatches: Array<{
      id: string;
      round: number;
      score1: number | null;
      score2: number | null;
      status: string;
      format: string;
      bracket: string;
      tournamentName: string;
      weekNumber: number;
      team1: { id: string; name: string };
      team2: { id: string; name: string } | null;
      mvpPlayer: { id: string; gamertag: string } | null;
      playerTeamId: string;
      result: 'win' | 'loss' | null;
    }> = [];

    if (teamIds.length > 0) {
      // Only include matches from tournaments that are in main_event or later status.
      // Tournaments in earlier statuses (e.g. bracket_generation after rollback)
      // should NOT show in player match history — those matches haven't been played yet.
      const activeTournamentStatuses = ['main_event', 'finalization', 'completed'];

      // Only show completed or live matches in history.
      // Pending/ready matches from rolled-back tournaments should not appear.
      const matchStatusFilter = { in: ['completed', 'live'] };

      // Get matches where any of the player's teams are team1 or team2
      const matchesAsTeam1 = await db.match.findMany({
        where: {
          team1Id: { in: teamIds },
          status: matchStatusFilter,
          tournament: { status: { in: activeTournamentStatuses } },
        },
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
          mvpPlayer: { select: { id: true, gamertag: true } },
          tournament: { select: { name: true, weekNumber: true } },
        },
        orderBy: { completedAt: 'desc' },
      });

      const matchesAsTeam2 = await db.match.findMany({
        where: {
          team2Id: { in: teamIds },
          status: matchStatusFilter,
          tournament: { status: { in: activeTournamentStatuses } },
        },
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
          mvpPlayer: { select: { id: true, gamertag: true } },
          tournament: { select: { name: true, weekNumber: true } },
        },
        orderBy: { completedAt: 'desc' },
      });

      const allMatches = [...matchesAsTeam1, ...matchesAsTeam2].sort(
        (a, b) => {
          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return dateB - dateA;
        }
      );

      // Deduplicate
      const seenIds = new Set<string>();

      tournamentMatches = allMatches
        .filter((m) => {
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          // Exclude BYE matches (team2 is null) — player did not actually play
          if (!m.team2Id) return false;
          return true;
        })
        .map((m) => {
          const isTeam1 = teamIds.includes(m.team1Id ?? '');
          const playerTeamId = isTeam1
            ? m.team1Id!
            : m.team2Id!;

          let result: 'win' | 'loss' | null = null;
          if (m.status === 'completed' && m.score1 !== null && m.score2 !== null) {
            if (isTeam1) {
              result = m.score1 > m.score2 ? 'win' : 'loss';
            } else {
              result = m.score2 > m.score1 ? 'win' : 'loss';
            }
          }

          return {
            id: m.id,
            round: m.round,
            score1: m.score1,
            score2: m.score2,
            status: m.status,
            format: m.format,
            bracket: m.bracket || 'upper',
            tournamentName: m.tournament.name,
            weekNumber: m.tournament.weekNumber,
            team1: { id: m.team1!.id, name: m.team1!.name },
            team2: m.team2 ? { id: m.team2.id, name: m.team2.name } : null,
            mvpPlayer: m.mvpPlayer,
            playerTeamId,
            result,
          };
        });
    }

    return NextResponse.json(
      {
        player: {
          id: player.id,
          gamertag: player.gamertag,
          division: player.division,
          tier: player.tier,
          club: clubProfile ? { id: clubProfile.id, name: clubProfile.name, logo: clubProfile.logo } : null,
        },
        tournamentMatches,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('[API /players/[id]/matches] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player matches' },
      { headers, status: 500 }
    );
  }
}
