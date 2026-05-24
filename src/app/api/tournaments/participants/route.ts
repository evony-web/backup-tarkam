import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/tournaments/participants?division=male
 *
 * Returns registered participants (WaRegistration) for the active tournament
 * in the given division. Includes both pending and approved registrations.
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
        participants: [],
        counts: { pending: 0, approved: 0, total: 0 },
      }, { headers });
    }

    // Find the active (non-completed) tournament
    const activeTournament = await db.tournament.findFirst({
      where: {
        seasonId: activeSeason.id,
        status: { not: 'completed' },
      },
      orderBy: { weekNumber: 'desc' },
      select: { id: true, name: true, weekNumber: true },
    });

    // If no active tournament, also check for the latest tournament
    const tournament = activeTournament || await db.tournament.findFirst({
      where: { seasonId: activeSeason.id },
      orderBy: { weekNumber: 'desc' },
      select: { id: true, name: true, weekNumber: true },
    });

    if (!tournament) {
      return NextResponse.json({
        success: true,
        tournamentId: null,
        tournamentName: null,
        weekNumber: null,
        participants: [],
        counts: { pending: 0, approved: 0, total: 0 },
      }, { headers });
    }

    // Fetch only registrations (pending + approved) — NOT registered (already in team)
    const registrations = await db.waRegistration.findMany({
      where: {
        tournamentId: tournament.id,
        division: divCode,
        status: { in: ['pending', 'approved'] },
      },
      orderBy: [
        { status: 'asc' }, // pending first, then approved
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        gamertag: true,
        name: true,
        division: true,
        city: true,
        status: true,
        assignedTier: true,
        createdAt: true,
      },
    });

    // Count by status
    const counts = {
      pending: registrations.filter(r => r.status === 'pending').length,
      approved: registrations.filter(r => r.status === 'approved').length,
      total: registrations.length,
    };

    return NextResponse.json({
      success: true,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      weekNumber: tournament.weekNumber,
      participants: registrations.map(r => ({
        id: r.id,
        gamertag: r.gamertag,
        name: r.name,
        division: r.division,
        city: r.city,
        status: r.status,
        tier: r.assignedTier || 'B',
        createdAt: r.createdAt,
      })),
      counts,
    }, { headers });
  } catch (error) {
    console.error('[PARTICIPANTS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
