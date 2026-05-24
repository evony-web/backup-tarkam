import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/tournaments/overview?division=male
// Returns tournament overview for the division: active tournament status, recent results, upcoming matches, top players
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division') || 'semua';
  const isAllDivisions = division === 'semua';
  const divisionFilter = isAllDivisions ? { in: ['male', 'female'] } : division;

  try {
    // Find the active or latest tournament for this division (or both if "semua")
    const activeTournament = await db.tournament.findFirst({
      where: {
        division: divisionFilter,
        status: { in: ['registration', 'approval', 'team_generation', 'bracket_generation', 'main_event', 'finalization'] },
      },
      include: {
        season: { select: { id: true, name: true, number: true } },
        teams: {
          include: {
            teamPlayers: {
              include: {
                player: { select: { id: true, name: true, gamertag: true, tier: true, avatar: true, points: true } },
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
        matches: {
          include: {
            team1: { include: { teamPlayers: { include: { player: { select: { id: true, gamertag: true, tier: true } } } } } },
            team2: { include: { teamPlayers: { include: { player: { select: { id: true, gamertag: true, tier: true } } } } } },
            winner: { select: { id: true, name: true } },
            mvpPlayer: { select: { id: true, gamertag: true } },
          },
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
        participations: {
          include: { player: { select: { id: true, name: true, gamertag: true, tier: true, avatar: true, points: true } } },
        },
        prizes: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no active tournament, check for completed ones
    const latestTournament = activeTournament || await db.tournament.findFirst({
      where: { division: divisionFilter },
      include: {
        season: { select: { id: true, name: true, number: true } },
        teams: {
          include: {
            teamPlayers: {
              include: {
                player: { select: { id: true, name: true, gamertag: true, tier: true, avatar: true, points: true } },
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
        matches: {
          include: {
            team1: { include: { teamPlayers: { include: { player: { select: { id: true, gamertag: true, tier: true } } } } } },
            team2: { include: { teamPlayers: { include: { player: { select: { id: true, gamertag: true, tier: true } } } } } },
            winner: { select: { id: true, name: true } },
            mvpPlayer: { select: { id: true, gamertag: true } },
          },
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
        participations: {
          include: { player: { select: { id: true, name: true, gamertag: true, tier: true, avatar: true, points: true } } },
        },
        prizes: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestTournament) {
      // No tournament at all for this division
      const playerCount = await db.player.count({ where: { division: divisionFilter, isActive: true, registrationStatus: 'approved' } });
      const clubCount = await db.club.count({ where: { division: divisionFilter } });
      return NextResponse.json({
        hasTournament: false,
        division,
        playerCount,
        clubCount,
        message: 'Belum ada tournament untuk divisi ini',
      }, { headers });
    }

    const t = latestTournament;

    // Count tier distribution from approved/assigned participations
    const approvedParts = t.participations.filter(p => ['approved', 'assigned'].includes(p.status));
    const tierCounts = { S: 0, A: 0, B: 0 };
    for (const p of approvedParts) {
      const tier = p.player.tier || 'B';
      if (tier === 'S') tierCounts.S++;
      else if (tier === 'A') tierCounts.A++;
      else tierCounts.B++;
    }

    // Count tier distribution from ALL participations (including registered)
    const tierCountsAll = { S: 0, A: 0, B: 0 };
    for (const p of t.participations) {
      const tier = p.player.tier || 'B';
      if (tier === 'S') tierCountsAll.S++;
      else if (tier === 'A') tierCountsAll.A++;
      else tierCountsAll.B++;
    }

    // Count registered (not yet approved) participants
    const registeredCount = t.participations.filter(p => p.status === 'registered').length;
    const approvedCount = approvedParts.length;

    // Get recent completed matches (last 5)
    const recentMatches = t.matches
      .filter(m => m.status === 'completed' && m.winnerId)
      .slice(-5)
      .reverse()
      .map(m => ({
        id: m.id,
        round: m.round,
        matchNumber: m.matchNumber,
        bracket: m.bracket,
        format: m.format,
        team1: { id: m.team1?.id, name: m.team1?.name || 'TBD' },
        team2: { id: m.team2?.id, name: m.team2?.name || 'TBD' },
        score1: m.score1,
        score2: m.score2,
        winner: m.winner?.name || null,
        mvpPlayer: m.mvpPlayer,
      }));

    // Get upcoming matches (next 5)
    const upcomingMatches = t.matches
      .filter(m => (m.status === 'ready' || m.status === 'pending') && m.team1Id && m.team2Id)
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        round: m.round,
        matchNumber: m.matchNumber,
        bracket: m.bracket,
        format: m.format,
        team1: { id: m.team1?.id, name: m.team1?.name || 'TBD' },
        team2: { id: m.team2?.id, name: m.team2?.name || 'TBD' },
        scheduledAt: m.scheduledAt,
      }));

    // Get live matches
    const liveMatches = t.matches
      .filter(m => m.status === 'live')
      .map(m => ({
        id: m.id,
        round: m.round,
        matchNumber: m.matchNumber,
        bracket: m.bracket,
        format: m.format,
        team1: { id: m.team1?.id, name: m.team1?.name || 'TBD' },
        team2: { id: m.team2?.id, name: m.team2?.name || 'TBD' },
        score1: m.score1,
        score2: m.score2,
      }));

    // Top teams by power
    const topTeams = t.teams
      .sort((a, b) => b.power - a.power)
      .slice(0, 5)
      .map(team => ({
        id: team.id,
        name: team.name,
        power: team.power,
        rank: team.rank,
        isWinner: team.isWinner,
        players: team.teamPlayers.map(tp => ({
          id: tp.player.id,
          gamertag: tp.player.gamertag,
          tier: tp.player.tier,
          points: tp.player.points,
        })),
      }));

    // Top participants by points (approved/assigned only)
    const topParticipants = approvedParts
      .sort((a, b) => b.player.points - a.player.points)
      .slice(0, 8)
      .map(p => ({
        id: p.player.id,
        name: p.player.name,
        gamertag: p.player.gamertag,
        tier: p.player.tier,
        avatar: p.player.avatar,
        points: p.player.points,
        status: p.status,
      }));

    // Registered participants (not yet approved)
    const registeredParticipants = t.participations
      .filter(p => p.status === 'registered')
      .sort((a, b) => a.player.gamertag.localeCompare(b.player.gamertag))
      .slice(0, 8)
      .map(p => ({
        id: p.player.id,
        name: p.player.name,
        gamertag: p.player.gamertag,
        tier: p.player.tier,
        avatar: p.player.avatar,
        points: p.player.points,
      }));

    // Tournament progress info
    const totalMatches = t.matches.length;
    const completedMatchCount = t.matches.filter(m => m.status === 'completed').length;
    const liveMatchCount = t.matches.filter(m => m.status === 'live').length;
    const progressPercent = totalMatches > 0 ? Math.round((completedMatchCount / totalMatches) * 100) : 0;

    // Champion info if completed
    let champion: { id: string; name: string; players: Array<{ id: string; gamertag: string; tier: string }> } | null = null;
    if (t.status === 'completed') {
      const winnerTeam = t.teams.find(tm => tm.isWinner || tm.rank === 1);
      if (winnerTeam) {
        champion = {
          id: winnerTeam.id,
          name: winnerTeam.name,
          players: winnerTeam.teamPlayers.map(tp => ({
            id: tp.player.id,
            gamertag: tp.player.gamertag,
            tier: tp.player.tier,
          })),
        };
      }
    }

    // Build phase timeline
    const phases = [
      { key: 'setup', label: 'Setup' },
      { key: 'registration', label: 'Daftar' },
      { key: 'approval', label: 'Approval' },
      { key: 'team_generation', label: 'Tim Dibentuk' },
      { key: 'bracket_generation', label: 'Bracket' },
      { key: 'main_event', label: 'Main Event' },
      { key: 'finalization', label: 'Finalisasi' },
      { key: 'completed', label: 'Selesai' },
    ];
    const currentPhaseIdx = phases.findIndex(p => p.key === t.status);

    return NextResponse.json({
      hasTournament: true,
      division,
      tournament: {
        id: t.id,
        name: t.name,
        weekNumber: t.weekNumber,
        status: t.status,
        format: t.format,
        prizePool: t.prizePool,
        location: t.location,
        bpm: t.bpm,
        scheduledAt: t.scheduledAt,
        season: t.season,
        totalTeams: t.teams.length,
        totalMatches,
        completedMatchCount,
        liveMatchCount,
        progressPercent,
        totalParticipants: t.participations.length,
        registeredCount,
        approvedCount,
        tierCounts,
        tierCountsAll,
        currentPhaseIdx,
        champion,
        prizes: t.prizes,
      },
      phases,
      recentMatches,
      upcomingMatches,
      liveMatches,
      topTeams,
      topParticipants,
      registeredParticipants,
    }, { headers });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('Tournament overview error:', error);
    return NextResponse.json({ error: 'Gagal mengambil overview tournament' }, { headers,  status: 500 });
  }
}
