import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/tournaments/my-status?name=xxx&division=female
// Find a player's tournament status: team, matches, opponent, alive status
// Supports completed tournaments with final results and prize info
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const gamertag = searchParams.get('gamertag');
  const division = searchParams.get('division');

  if (!name && !gamertag) {
    return NextResponse.json({ error: 'Parameter name atau nickname wajib diisi' }, { headers,  status: 400 });
  }

  try {
    // Step 1: Find the player — always search by both name AND gamertag using OR
    // Bug fix: Previously, when both name and gamertag params were provided (frontend sends same value),
    // only gamertag was searched, missing players whose name ≠ gamertag.
    // Now always use OR search to cover both fields regardless of which params are provided.
    const playerWhere: Record<string, unknown> = {};
    const searchTerms: string[] = [];
    if (name) searchTerms.push(name);
    if (gamertag && gamertag !== name) searchTerms.push(gamertag);

    // PostgreSQL supports `mode: 'insensitive'` for case-insensitive search
    if (searchTerms.length > 0) {
      const orConditions: Record<string, unknown>[] = [];
      for (const term of searchTerms) {
        orConditions.push(
          { name: { contains: term, mode: 'insensitive' }, isActive: true, ...(division ? { division } : {}) },
          { gamertag: { contains: term, mode: 'insensitive' }, isActive: true, ...(division ? { division } : {}) },
        );
      }
      playerWhere.OR = orConditions;
    }

    const player = await db.player.findFirst({
      where: playerWhere,
      select: {
        id: true,
        name: true,
        gamertag: true,
        division: true,
        tier: true,
        avatar: true,
        city: true,
      },
    });

    if (!player) {
      return NextResponse.json({ found: false, message: 'Pemain tidak ditemukan' }, { headers });
    }

    // Step 2: Find the active or completed tournament (filtered by player's division)
    // Includes 'completed' so players can see their final results after a tournament ends
    const activeTournament = await db.tournament.findFirst({
      where: {
        division: player.division,
        status: { in: ['registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization', 'completed'] },
      },
      include: {
        season: { select: { id: true, name: true, number: true } },
        teams: {
          include: {
            teamPlayers: {
              include: {
                player: {
                  select: { id: true, name: true, gamertag: true, tier: true, avatar: true },
                },
              },
            },
          },
        },
        matches: {
          include: {
            team1: {
              include: {
                teamPlayers: {
                  include: {
                    player: { select: { id: true, name: true, gamertag: true, tier: true } },
                  },
                },
              },
            },
            team2: {
              include: {
                teamPlayers: {
                  include: {
                    player: { select: { id: true, name: true, gamertag: true, tier: true } },
                  },
                },
              },
            },
            mvpPlayer: { select: { id: true, name: true, gamertag: true } },
          },
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no active or completed tournament, check for any tournament in player's division
    if (!activeTournament) {
      const latestTournament = await db.tournament.findFirst({
        where: { division: player.division },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          weekNumber: true,
          status: true,
          format: true,
        },
      });

      return NextResponse.json({
        found: true,
        player,
        hasActiveTournament: false,
        latestTournament,
        message: latestTournament
          ? `Tournament terakhir (${latestTournament.name}) status: ${latestTournament.status}`
          : 'Belum ada tournament untuk division ini',
      }, { headers });
    }

    const isCompleted = activeTournament.status === 'completed';

    // Step 3: Find the player's team in this tournament
    const myTeam = activeTournament.teams.find(t =>
      t.teamPlayers.some(tp => tp.playerId === player.id)
    );

    if (!myTeam) {
      // Player is not in any team yet (maybe not registered, or teams not generated)
      const participation = await db.participation.findFirst({
        where: {
          playerId: player.id,
          tournamentId: activeTournament.id,
        },
      });

      return NextResponse.json({
        found: true,
        player,
        hasActiveTournament: true,
        tournament: {
          id: activeTournament.id,
          name: activeTournament.name,
          weekNumber: activeTournament.weekNumber,
          status: activeTournament.status,
          format: activeTournament.format,
          prizePool: activeTournament.prizePool,
          scheduledAt: activeTournament.scheduledAt,
          location: activeTournament.location,
          bpm: activeTournament.bpm,
          season: activeTournament.season,
          totalTeams: activeTournament.teams.length,
          totalMatches: activeTournament.matches.length,
          isCompleted,
          completedAt: activeTournament.completedAt,
        },
        myTeam: null,
        participationStatus: participation?.status || null,
        message: participation
          ? `Anda terdaftar tapi belum masuk tim. Status: ${participation.status}`
          : 'Anda belum terdaftar di tournament ini',
      }, { headers });
    }

    // Step 3b: Fetch participation data for prize/rank info (especially for completed tournaments)
    const participation = await db.participation.findFirst({
      where: {
        playerId: player.id,
        tournamentId: activeTournament.id,
      },
    });

    // Step 4: Find all matches involving myTeam
    const myMatches = activeTournament.matches.filter(
      m => m.team1Id === myTeam.id || m.team2Id === myTeam.id
    );

    // Step 5: Determine match status
    const completedMatches = myMatches.filter(m => m.status === 'completed' || (m.score1 !== null && m.score2 !== null));
    const upcomingMatches = myMatches.filter(m => m.status !== 'completed' && m.status !== 'live' && m.team1Id && m.team2Id);
    const liveMatch = myMatches.find(m => m.status === 'live');
    const nextMatch = upcomingMatches[0] || null;

    // Step 6: Determine if team is eliminated or still alive
    let isEliminated = false;
    let isChampion = false;
    let eliminationInfo: string | null = null;

    if (activeTournament.format === 'single_elimination') {
      // In single elimination, any loss = eliminated
      const lostMatch = completedMatches.find(m => {
        const isTeam1 = m.team1Id === myTeam.id;
        if (isTeam1) return m.score1 !== null && m.score2 !== null && m.score1 < m.score2;
        return m.score1 !== null && m.score2 !== null && m.score2 < m.score1;
      });
      if (lostMatch) {
        isEliminated = true;
        const winnerId = lostMatch.winnerId;
        const winnerTeam = activeTournament.teams.find(t => t.id === winnerId);
        eliminationInfo = `Kalah dari ${winnerTeam?.name || '??'} dengan skor ${lostMatch.score1}-${lostMatch.score2}`;
      }
      // Check if champion
      const finalMatch = activeTournament.matches.find(m =>
        m.status === 'completed' && (m.round === Math.max(...activeTournament.matches.map(m2 => m2.round)))
      );
      if (finalMatch && finalMatch.winnerId === myTeam.id) {
        isChampion = true;
        isEliminated = false;
      }
    } else {
      // Group stage / round robin / swiss
      if (myTeam.isWinner) isChampion = true;
    }

    // Step 7: Format match data
    const formattedMatches = myMatches.map(m => {
      const isTeam1 = m.team1Id === myTeam.id;
      const opponentTeam = isTeam1 ? m.team2 : m.team1;
      const myScore = isTeam1 ? m.score1 : m.score2;
      const opponentScore = isTeam1 ? m.score2 : m.score1;
      const won = m.score1 !== null && m.score2 !== null && m.winnerId === myTeam.id;
      const lost = m.score1 !== null && m.score2 !== null && m.winnerId && m.winnerId !== myTeam.id;
      const isDraw = m.score1 !== null && m.score2 !== null && m.score1 === m.score2;

      return {
        id: m.id,
        round: m.round,
        matchNumber: m.matchNumber,
        bracket: m.bracket,
        status: m.status,
        format: m.format,
        opponent: {
          id: opponentTeam?.id,
          name: opponentTeam?.name || 'TBD',
          players: opponentTeam?.teamPlayers?.map(tp => ({
            id: tp.player.id,
            name: tp.player.name,
            gamertag: tp.player.gamertag,
            tier: tp.player.tier,
          })) || [],
        },
        myScore,
        opponentScore,
        won,
        lost,
        isDraw,
        mvpPlayer: m.mvpPlayer,
        scheduledAt: m.scheduledAt,
      };
    });

    // Step 8: Format next match opponent info
    let nextOpponent: { id: string | undefined; name: string; players: Array<{ id: string; name: string; gamertag: string; tier: string }> } | null = null;
    if (nextMatch) {
      const isTeam1 = nextMatch.team1Id === myTeam.id;
      const opponent = isTeam1 ? nextMatch.team2 : nextMatch.team1;
      nextOpponent = {
        id: opponent?.id,
        name: opponent?.name || 'TBD',
        players: opponent?.teamPlayers?.map(tp => ({
          id: tp.player.id,
          name: tp.player.name,
          gamertag: tp.player.gamertag,
          tier: tp.player.tier,
        })) || [],
      };
    }

    // Build response with completed tournament data
    const response: Record<string, unknown> = {
      found: true,
      player,
      hasActiveTournament: true,
      tournament: {
        id: activeTournament.id,
        name: activeTournament.name,
        weekNumber: activeTournament.weekNumber,
        status: activeTournament.status,
        format: activeTournament.format,
        prizePool: activeTournament.prizePool,
        scheduledAt: activeTournament.scheduledAt,
        location: activeTournament.location,
        bpm: activeTournament.bpm,
        season: activeTournament.season,
        totalTeams: activeTournament.teams.length,
        totalMatches: activeTournament.matches.length,
        isCompleted,
        completedAt: activeTournament.completedAt,
      },
      myTeam: {
        id: myTeam.id,
        name: myTeam.name,
        power: myTeam.power,
        isWinner: myTeam.isWinner,
        rank: myTeam.rank,
        teammates: myTeam.teamPlayers.map(tp => ({
          id: tp.player.id,
          name: tp.player.name,
          gamertag: tp.player.gamertag,
          tier: tp.player.tier,
          avatar: tp.player.avatar,
          isMe: tp.player.id === player.id,
        })),
      },
      myMatches: formattedMatches,
      liveMatch: liveMatch ? formattedMatches.find(m => m.id === liveMatch.id) : null,
      nextMatch: nextMatch ? formattedMatches.find(m => m.id === nextMatch.id) : null,
      nextOpponent,
      completedMatchCount: completedMatches.length,
      upcomingMatchCount: upcomingMatches.length,
      isEliminated,
      isChampion,
      eliminationInfo,
      matchRecord: {
        wins: formattedMatches.filter(m => m.won).length,
        losses: formattedMatches.filter(m => m.lost).length,
        draws: formattedMatches.filter(m => m.isDraw).length,
      },
    };

    // Include participation data for completed tournaments (rank, prize info, final results)
    if (isCompleted && participation) {
      response.participation = {
        pointsEarned: participation.pointsEarned,
        isWinner: participation.isWinner,
        isMvp: participation.isMvp,
        status: participation.status,
      };
      // Also include team rank at top level for easy access
      response.teamRank = myTeam.rank;
      response.prizeInfo = {
        pointsEarned: participation.pointsEarned,
        isWinner: participation.isWinner,
        isMvp: participation.isMvp,
        teamRank: myTeam.rank,
      };
    }

    return NextResponse.json(response, { headers });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('My-status error:', error);
    return NextResponse.json({ error: 'Gagal mengambil status tournament' }, { headers,  status: 500 });
  }
}
