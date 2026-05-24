import { db, neonUpdateMany, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';

interface ManualTeamInput {
  name: string;
  players: {
    S: string;
    A: string;
    B: string;
  };
}

// ─── GET: Return existing teams for a tournament (for verification) ───
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const teams = await db.team.findMany({
      where: { tournamentId: id },
      include: { teamPlayers: { include: { player: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ teams, teamCount: teams.length });
  } catch (error) {
    console.error('[manual-teams GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ─── POST: Create teams manually with specific player assignments ───
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // Parse request body
    const body = await request.json();
    const { teams: teamsInput }: { teams: ManualTeamInput[] } = body;

    if (!teamsInput || !Array.isArray(teamsInput) || teamsInput.length === 0) {
      return NextResponse.json(
        { error: 'Teams array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each team input
    for (let i = 0; i < teamsInput.length; i++) {
      const team = teamsInput[i];
      if (!team.name || typeof team.name !== 'string') {
        return NextResponse.json(
          { error: `Team at index ${i} is missing a valid name` },
          { status: 400 }
        );
      }
      if (!team.players || !team.players.S || !team.players.A || !team.players.B) {
        return NextResponse.json(
          { error: `Team "${team.name}" must have players for all tiers (S, A, B)` },
          { status: 400 }
        );
      }
    }

    // Verify tournament exists
    const tournament = await db.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Collect all unique gamertags from all teams
    const allGamertags: string[] = [];
    for (const team of teamsInput) {
      allGamertags.push(team.players.S, team.players.A, team.players.B);
    }
    const uniqueGamertags = [...new Set(allGamertags.map((g) => g.toUpperCase()))];

    // Look up player IDs by gamertag (case-insensitive)
    const players = await db.player.findMany({
      where: {
        gamertag: { in: uniqueGamertags },
      },
    });

    // Build a case-insensitive lookup map: gamertag.toUpperCase() -> player
    const playerByGamertag = new Map<string, typeof players[number]>();
    for (const player of players) {
      playerByGamertag.set(player.gamertag.toUpperCase(), player);
    }

    // Validate that all gamertags were found
    const notFound: string[] = [];
    for (const gamertag of allGamertags) {
      if (!playerByGamertag.has(gamertag.toUpperCase())) {
        // Avoid duplicates in the not-found list
        if (!notFound.some((g) => g.toUpperCase() === gamertag.toUpperCase())) {
          notFound.push(gamertag);
        }
      }
    }

    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `Players not found: ${notFound.join(', ')}`, notFound },
        { status: 400 }
      );
    }

    // Check for duplicate player assignments across teams
    const assignedPlayerIds = new Set<string>();
    for (const team of teamsInput) {
      const sPlayer = playerByGamertag.get(team.players.S.toUpperCase())!;
      const aPlayer = playerByGamertag.get(team.players.A.toUpperCase())!;
      const bPlayer = playerByGamertag.get(team.players.B.toUpperCase())!;

      for (const player of [sPlayer, aPlayer, bPlayer]) {
        if (assignedPlayerIds.has(player.id)) {
          return NextResponse.json(
            { error: `Player "${player.gamertag}" is assigned to multiple teams` },
            { status: 400 }
          );
        }
        assignedPlayerIds.add(player.id);
      }
    }

    // ─── Delete existing teams first (regeneration support) ───
    const existingTeams = await db.team.findMany({ where: { tournamentId: id } });
    if (existingTeams.length > 0) {
      const teamIds = existingTeams.map((t) => t.id);
      if (isPostgreSQL) {
        // Delete TeamPlayers first (FK constraint), then Teams
        await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: 'IN', value: teamIds }]);
        await neonDeleteMany('Team', [{ column: 'tournamentId', operator: '=', value: id }]);
      } else {
        await db.teamPlayer.deleteMany({
          where: { teamId: { in: teamIds } },
        });
        await db.team.deleteMany({ where: { tournamentId: id } });
      }
    }

    // ─── Create teams with correct power calculation ───
    const createdTeams: { id: string; name: string; power: number }[] = [];

    for (const teamInput of teamsInput) {
      const sPlayer = playerByGamertag.get(teamInput.players.S.toUpperCase())!;
      const aPlayer = playerByGamertag.get(teamInput.players.A.toUpperCase())!;
      const bPlayer = playerByGamertag.get(teamInput.players.B.toUpperCase())!;

      // Power = sum of all player points
      const power = sPlayer.points + aPlayer.points + bPlayer.points;

      const team = await db.team.create({
        data: {
          name: teamInput.name,
          tournamentId: id,
          power,
        },
      });

      // Create TeamPlayer entries with tier
      if (isPostgreSQL) {
        // Neon HTTP adapter does NOT support createMany — use individual creates
        await db.teamPlayer.create({
          data: { teamId: team.id, playerId: sPlayer.id, tier: 'S' },
        });
        await db.teamPlayer.create({
          data: { teamId: team.id, playerId: aPlayer.id, tier: 'A' },
        });
        await db.teamPlayer.create({
          data: { teamId: team.id, playerId: bPlayer.id, tier: 'B' },
        });
      } else {
        await db.teamPlayer.createMany({
          data: [
            { teamId: team.id, playerId: sPlayer.id, tier: 'S' },
            { teamId: team.id, playerId: aPlayer.id, tier: 'A' },
            { teamId: team.id, playerId: bPlayer.id, tier: 'B' },
          ],
        });
      }

      createdTeams.push({ id: team.id, name: teamInput.name, power });
    }

    // ─── Update tournament status to 'team_generation' ───
    await db.tournament.update({
      where: { id },
      data: { status: 'team_generation' },
    });

    // ─── Update participation statuses from 'approved' to 'assigned' ───
    if (isPostgreSQL) {
      await neonUpdateMany(
        'Participation',
        [
          { column: 'tournamentId', operator: '=', value: id },
          { column: 'status', operator: '=', value: 'approved' },
        ],
        { status: 'assigned' },
      );
    } else {
      await db.participation.updateMany({
        where: { tournamentId: id, status: 'approved' },
        data: { status: 'assigned' },
      });
    }

    // ─── Fetch final teams with full player data ───
    const finalTeams = await db.team.findMany({
      where: { tournamentId: id },
      include: { teamPlayers: { include: { player: true } } },
      orderBy: { name: 'asc' },
    });

    // ─── Pusher: Notify real-time clients ───
    void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_STATUS_CHANGED, {
      tournamentId: id,
      division: tournament.division,
      teamCount: createdTeams.length,
      status: 'team_generation',
    });
    void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
      type: 'teams-generated',
      tournamentId: id,
      division: tournament.division,
      teamCount: createdTeams.length,
    });

    // ─── Audit log ───
    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'create',
      entity: 'tournament',
      entityId: id,
      details: 'Manual team creation',
      metadata: {
        tournamentId: id,
        teamCount: createdTeams.length,
        teamNames: createdTeams.map((t) => t.name),
      },
    });

    return NextResponse.json({
      teams: finalTeams,
      teamCount: createdTeams.length,
    });
  } catch (error) {
    console.error('[manual-teams POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create manual teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
