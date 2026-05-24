import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
  'Surrogate-Key': 'league-data',
};

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division') || 'male';

  // Find the latest active season for this division
  const season = await db.season.findFirst({
    where: { division, status: { in: ['active', 'completed'] } },
    orderBy: { number: 'desc' },
  });

  if (!season) {
    return NextResponse.json({
      tierDistribution: [],
      clubPerformance: [],
      weeklyTrend: [],
      topPerformers: [],
    }, { headers: CACHE_HEADERS });
  }

  // Find season with clubs for club/league data
  const seasonWithClubs = await db.season.findFirst({
    where: {
      division,
      id: season.id,
      clubs: { some: {} },
    },
    orderBy: { number: 'desc' },
  });
  const activeSeasonId = seasonWithClubs?.id || season.id;

  // Run all independent queries in parallel
  const [
    players,
    clubs,
    tournaments,
    participations,
  ] = await Promise.all([
    // All active players in this division
    db.player.findMany({
      where: { division, isActive: true, registrationStatus: 'approved' },
      select: {
        tier: true,
        points: true,
        totalWins: true,
        totalMvp: true,
        gamertag: true,
      },
    }),

    // Clubs for this season
    db.club.findMany({
      where: { seasonId: activeSeasonId },
      orderBy: { points: 'desc' },
      include: { profile: { include: { _count: { select: { members: true } } } } },
    }),

    // Tournaments for this season (for weekly trend)
    db.tournament.findMany({
      where: { seasonId: activeSeasonId },
      orderBy: { weekNumber: 'asc' },
      include: {
        _count: { select: { participations: true } },
      },
    }),

    // All participations for this season's tournaments
    db.participation.findMany({
      where: {
        tournament: { seasonId: activeSeasonId },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, tournamentId: true },
    }),
  ]);

  // ── Tier Distribution ──
  const tierOrder = ['S', 'A', 'B', 'C', 'D'];
  const tierCountMap: Record<string, number> = {};
  for (const tier of tierOrder) tierCountMap[tier] = 0;
  for (const p of players) {
    const t = p.tier.toUpperCase();
    if (tierCountMap[t] !== undefined) {
      tierCountMap[t]++;
    } else {
      tierCountMap['B']++; // Default unknown tiers to B
    }
  }
  const tierDistribution = tierOrder
    .filter(tier => tierCountMap[tier] > 0)
    .map(tier => ({ tier, count: tierCountMap[tier] }));

  // ── Club Performance ──
  const clubPerformance = clubs.slice(0, 8).map((club: any) => ({
    club: club.profile?.name || '',
    points: club.points,
    wins: club.wins,
    members: club.profile?._count?.members ?? 0,
  }));

  // ── Weekly Trend ──
  // Build a map of week → registration count
  const weekRegMap: Record<number, number> = {};

  // Count registrations per week from participations
  for (const p of participations) {
    // Find which tournament/week this belongs to
    const t = tournaments.find(t => t.id === p.tournamentId);
    if (t) {
      weekRegMap[t.weekNumber] = (weekRegMap[t.weekNumber] || 0) + 1;
    }
  }

  // Also add tournament data for weeks
  const allWeeks = new Set<number>();
  for (const t of tournaments) allWeeks.add(t.weekNumber);

  const weeklyTrend = Array.from(allWeeks)
    .sort((a, b) => a - b)
    .map(week => ({
      week,
      registrations: weekRegMap[week] || 0,
    }));

  // ── Top Performers ──
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.totalMvp - a.totalMvp;
  });

  const topPerformers = sortedPlayers.slice(0, 5).map(p => ({
    gamertag: p.gamertag,
    points: p.points,
    wins: p.totalWins,
    mvp: p.totalMvp,
  }));

  return NextResponse.json({
    tierDistribution,
    clubPerformance,
    weeklyTrend,
    topPerformers,
  }, { headers: CACHE_HEADERS });
}
