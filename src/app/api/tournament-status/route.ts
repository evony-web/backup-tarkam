import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic — always fresh
export const dynamic = 'force-dynamic';

// Lightweight endpoint that returns ONLY the active tournament status per division.
// Used by the landing page to quickly determine if registration is open,
// without waiting for the full /api/stats response (which is heavy & slow).
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
  'Surrogate-Key': 'league-data',
  'Vary': 'Accept-Encoding',
};

export async function GET() {
  try {
    // Get the latest active season for each division
    const [maleSeason, femaleSeason] = await Promise.all([
      db.season.findFirst({
        where: { division: 'male', status: { in: ['active', 'completed'] } },
        orderBy: { number: 'desc' },
        select: { id: true },
      }),
      db.season.findFirst({
        where: { division: 'female', status: { in: ['active', 'completed'] } },
        orderBy: { number: 'desc' },
        select: { id: true },
      }),
    ]);

    // Find the latest non-completed tournament for each division (fast — only status field)
    const [maleTournament, femaleTournament] = await Promise.all([
      maleSeason
        ? db.tournament.findFirst({
            where: { seasonId: maleSeason.id, status: { not: 'completed' } },
            orderBy: { weekNumber: 'desc' },
            select: { id: true, status: true, name: true, weekNumber: true },
          })
        : null,
      femaleSeason
        ? db.tournament.findFirst({
            where: { seasonId: femaleSeason.id, status: { not: 'completed' } },
            orderBy: { weekNumber: 'desc' },
            select: { id: true, status: true, name: true, weekNumber: true },
          })
        : null,
    ]);

    // If no non-completed tournament, also check for latest completed (so we know the state)
    const [maleLatest, femaleLatest] = await Promise.all([
      !maleTournament && maleSeason
        ? db.tournament.findFirst({
            where: { seasonId: maleSeason.id },
            orderBy: { weekNumber: 'desc' },
            select: { id: true, status: true, name: true, weekNumber: true },
          })
        : maleTournament,
      !femaleTournament && femaleSeason
        ? db.tournament.findFirst({
            where: { seasonId: femaleSeason.id },
            orderBy: { weekNumber: 'desc' },
            select: { id: true, status: true, name: true, weekNumber: true },
          })
        : femaleTournament,
    ]);

    const isRegistrationOpen = (status: string | null | undefined) =>
      status === 'registration' || status === 'approval';

    return NextResponse.json({
      male: {
        tournamentId: maleLatest?.id || null,
        status: maleLatest?.status || null,
        name: maleLatest?.name || null,
        weekNumber: maleLatest?.weekNumber || null,
        isRegistrationOpen: isRegistrationOpen(maleLatest?.status),
      },
      female: {
        tournamentId: femaleLatest?.id || null,
        status: femaleLatest?.status || null,
        name: femaleLatest?.name || null,
        weekNumber: femaleLatest?.weekNumber || null,
        isRegistrationOpen: isRegistrationOpen(femaleLatest?.status),
      },
    }, {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    console.error('[GET /api/tournament-status]', error);
    return NextResponse.json(
      { male: { tournamentId: null, status: null, isRegistrationOpen: false }, female: { tournamentId: null, status: null, isRegistrationOpen: false } },
      { status: 500 }
    );
  }
}
