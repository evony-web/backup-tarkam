import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/tournaments/approved-players?division=male
 *
 * Returns participants for the current active tournament in a division,
 * enriched with player avatar, club name, and latest points.
 *
 * Hybrid data source based on tournament phase:
 *
 * 1. Teams exist (bracket generated / in_progress / completed):
 *    - Approved = TeamPlayer members (players actually in teams/brackets)
 *    - Pending = WaRegistration entries with status='pending' (registered but not yet in a team)
 *
 * 2. No teams yet (registration / approval phase):
 *    - Approved = WaRegistration entries with status='approved'
 *    - Pending = WaRegistration entries with status='pending'
 *
 * 3. Last resort (no teams, no WaRegistration):
 *    - Approved = Participation records for the tournament
 *    - No pending
 *
 * Used by the "Peserta TARKAM" modal on the landing page.
 */
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division') || 'male';

    // Normalize division for WaRegistration (M/F format)
    const divCode = division === 'male' ? 'M' : 'F';

    // Find the active season for this division
    const activeSeason = await db.season.findFirst({
      where: { division, status: { in: ['active', 'pre_season'] } },
      orderBy: { number: 'desc' },
    });

    if (!activeSeason) {
      return NextResponse.json({
        success: true,
        tournamentId: null,
        tournamentName: null,
        weekNumber: null,
        seasonName: null,
        participants: [],
        counts: { approved: 0, pending: 0, total: 0 },
      }, { headers });
    }

    // Capture activeSeason.id to avoid possibly-null reference in nested function
    const activeSeasonId = activeSeason.id;

    // Find the active (non-completed) tournament, or latest tournament
    const activeTournament = await db.tournament.findFirst({
      where: { seasonId: activeSeasonId, status: { not: 'completed' } },
      orderBy: { weekNumber: 'desc' },
      select: { id: true, name: true, weekNumber: true },
    });

    const tournament = activeTournament || await db.tournament.findFirst({
      where: { seasonId: activeSeasonId },
      orderBy: { weekNumber: 'desc' },
      select: { id: true, name: true, weekNumber: true },
    });

    if (!tournament) {
      return NextResponse.json({
        success: true,
        tournamentId: null,
        tournamentName: null,
        weekNumber: null,
        seasonName: activeSeason.name,
        participants: [],
        counts: { approved: 0, pending: 0, total: 0 },
      }, { headers });
    }

    let approvedParticipants: any[] = [];
    let pendingParticipants: any[] = [];

    // Helper: enrich player data with avatar, club, season stats
    async function enrichPlayers(playerIds: string[]) {
      if (playerIds.length === 0) return new Map();
      const players = await db.player.findMany({
        where: { id: { in: playerIds } },
        select: {
          id: true,
          gamertag: true,
          name: true,
          city: true,
          avatar: true,
          points: true,
          tier: true,
          clubMembers: {
            where: { leftAt: null },
            include: { profile: { select: { name: true, logo: true } } },
            take: 1,
          },
          seasonStats: {
            where: { seasonId: activeSeasonId },
            select: { points: true, rank: true },
            take: 1,
          },
        },
      });
      return new Map(players.map(p => [p.id, p]));
    }

    // Helper: map player data to participant response
    function mapPlayerToParticipant(id: string, playerMap: Map<string, any>, extra?: Record<string, any>) {
      const player = playerMap.get(id);
      const clubMember = player?.clubMembers?.[0];
      const seasonStat = player?.seasonStats?.[0];
      return {
        id: extra?.id || id,
        gamertag: player?.gamertag || extra?.gamertag || 'Unknown',
        name: player?.name || extra?.name || '',
        city: player?.city || extra?.city || '',
        tier: extra?.tier || player?.tier || 'B',
        avatar: player?.avatar || null,
        points: seasonStat?.points ?? player?.points ?? 0,
        clubName: clubMember?.profile?.name || extra?.clubName || null,
        clubLogo: clubMember?.profile?.logo || null,
        seasonRank: seasonStat?.rank ?? null,
        status: extra?.status || 'approved',
        ...extra,
      };
    }

    // ── Check if teams exist (bracket generated) ──
    const teamsCount = await db.team.count({
      where: { tournamentId: tournament.id },
    });

    if (teamsCount > 0) {
      // ═══ PHASE 1: Teams exist — use TeamPlayer as source of truth ═══
      const teamPlayers = await db.teamPlayer.findMany({
        where: { team: { tournamentId: tournament.id } },
        select: { playerId: true },
      });

      const approvedPlayerIds = [...new Set(teamPlayers.map(tp => tp.playerId))];
      const playerMap = await enrichPlayers(approvedPlayerIds);

      approvedParticipants = approvedPlayerIds.map(playerId =>
        mapPlayerToParticipant(playerId, playerMap)
      );
    } else {
      // ═══ PHASE 2: No teams yet — try WaRegistration ═══
      const approvedRegs = await db.waRegistration.findMany({
        where: {
          tournamentId: tournament.id,
          division: divCode,
          status: 'approved',
        },
        select: {
          id: true,
          gamertag: true,
          name: true,
          city: true,
          clubName: true,
          assignedTier: true,
          playerId: true,
        },
      });

      if (approvedRegs.length > 0) {
        const playerIds = approvedRegs.map(r => r.playerId).filter((id): id is string => !!id);
        const playerMap = await enrichPlayers(playerIds);

        approvedParticipants = approvedRegs.map(reg =>
          mapPlayerToParticipant(reg.playerId || reg.id, playerMap, {
            id: reg.id,
            gamertag: reg.gamertag,
            name: reg.name,
            city: reg.city,
            tier: reg.assignedTier,
            clubName: reg.clubName,
          })
        );
      } else {
        // ═══ PHASE 3: Last resort — Participation records ═══
        const participations = await db.participation.findMany({
          where: { tournamentId: tournament.id },
          select: { id: true, playerId: true },
        });

        const playerIds = participations.map(p => p.playerId).filter(Boolean) as string[];
        const playerMap = await enrichPlayers(playerIds);

        approvedParticipants = participations.map(part =>
          mapPlayerToParticipant(part.playerId, playerMap, { id: part.id })
        );
      }
    }

    // ── Fetch pending WaRegistration entries (always, regardless of phase) ──
    const pendingRegs = await db.waRegistration.findMany({
      where: {
        tournamentId: tournament.id,
        division: divCode,
        status: 'pending',
      },
      select: {
        id: true,
        gamertag: true,
        name: true,
        city: true,
        clubName: true,
        assignedTier: true,
        playerId: true,
        createdAt: true,
      },
    });

    if (pendingRegs.length > 0) {
      const pendingPlayerIds = pendingRegs.map(r => r.playerId).filter((id): id is string => !!id);
      const pendingPlayerMap = await enrichPlayers(pendingPlayerIds);

      pendingParticipants = pendingRegs.map(reg =>
        mapPlayerToParticipant(reg.playerId || reg.id, pendingPlayerMap, {
          id: reg.id,
          gamertag: reg.gamertag,
          name: reg.name,
          city: reg.city,
          tier: reg.assignedTier,
          clubName: reg.clubName,
          status: 'pending',
          createdAt: reg.createdAt,
        })
      );
    }

    // Sort approved by points descending
    approvedParticipants.sort((a, b) => b.points - a.points);
    // Assign rank
    approvedParticipants.forEach((p, i) => { p.rank = i + 1; });
    // Pending get rank 0
    pendingParticipants.forEach((p) => { p.rank = 0; });

    const sortedParticipants = [...approvedParticipants, ...pendingParticipants];
    const approvedCount = approvedParticipants.length;
    const pendingCount = pendingParticipants.length;

    return NextResponse.json({
      success: true,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      weekNumber: tournament.weekNumber,
      seasonName: activeSeason.name,
      participants: sortedParticipants,
      counts: { approved: approvedCount, pending: pendingCount, total: approvedCount + pendingCount },
    }, { headers });
  } catch (error) {
    console.error('[APPROVED_PLAYERS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
