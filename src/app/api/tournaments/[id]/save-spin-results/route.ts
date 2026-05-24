import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const body = await request.json();
    const { teamAssignments } = body;

    if (!teamAssignments || !Array.isArray(teamAssignments)) {
      return NextResponse.json(
        { error: 'teamAssignments required' },
        { status: 400 }
      );
    }

    const tournament = await db.tournament.findUnique({ where: { id } });
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get existing teams ordered by name
    const existingTeams = await db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
    });

    for (const assignment of teamAssignments) {
      const team = existingTeams[assignment.teamIndex];
      if (!team) continue;

      // Get player data for power calculation and name
      const players = await db.player.findMany({
        where: {
          id: {
            in: [assignment.sPlayerId, assignment.aPlayerId, assignment.bPlayerId],
          },
          isActive: true,
        },
      });

      const sPlayer = players.find((p) => p.id === assignment.sPlayerId);
      const aPlayer = players.find((p) => p.id === assignment.aPlayerId);
      const bPlayer = players.find((p) => p.id === assignment.bPlayerId);

      if (!sPlayer || !aPlayer || !bPlayer) continue;

      // Delete existing team players
      // Neon HTTP adapter does NOT support deleteMany with complex where — use raw SQL
      if (isPostgreSQL) {
        await neonDeleteMany('TeamPlayer', [{ column: 'teamId', operator: '=', value: team.id }]);
      } else {
        await db.teamPlayer.deleteMany({ where: { teamId: team.id } });
      }

      // Create new team players
      // Neon HTTP adapter does NOT support createMany — use individual creates
      if (isPostgreSQL) {
        await db.teamPlayer.create({ data: { teamId: team.id, playerId: assignment.sPlayerId, tier: 'S' } });
        await db.teamPlayer.create({ data: { teamId: team.id, playerId: assignment.aPlayerId, tier: 'A' } });
        await db.teamPlayer.create({ data: { teamId: team.id, playerId: assignment.bPlayerId, tier: 'B' } });
      } else {
        await db.teamPlayer.createMany({
          data: [
            { teamId: team.id, playerId: assignment.sPlayerId },
            { teamId: team.id, playerId: assignment.aPlayerId },
            { teamId: team.id, playerId: assignment.bPlayerId },
          ],
        });
      }

      // Update team name and power
      const power = sPlayer.points + aPlayer.points + bPlayer.points;
      await db.team.update({
        where: { id: team.id },
        data: { name: `Tim ${sPlayer.gamertag}`, power },
      });
    }

    // Return updated teams
    const updatedTeams = await db.team.findMany({
      where: { tournamentId: id },
      include: { teamPlayers: { include: { player: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ teams: updatedTeams });
  } catch (error) {
    console.error('[save-spin-results] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save spin results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
