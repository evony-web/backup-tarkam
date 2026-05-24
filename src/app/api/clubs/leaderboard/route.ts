import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

// CDN caching: 10s edge cache, 30s stale-while-revalidate
const LEADERBOARD_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Surrogate-Key': 'league-data',
  'Vary': 'Accept-Encoding',
};

interface LeaderboardClub {
  id: string;
  name: string;
  logo: string | null;
  bannerImage: string | null;
  points: number;
  malePoints: number;
  femalePoints: number;
  wins: number;
  losses: number;
  gameDiff: number;
  memberCount: number;
  maleMemberCount: number;
  femaleMemberCount: number;
  rank: number;
}

/**
 * GET /api/clubs/leaderboard?type=tarkam|liga
 *
 * Tarkam: Club points = sum of all active member per-season points across both divisions.
 * Liga:   Club points = from Liga match results (stored Club.wins/losses/points/gameDiff per season).
 *
 * Per-season points: For tarkam mode, player points are computed from PlayerPoint records
 * for the active season of each division (not lifetime Player.points).
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'tarkam'; // "tarkam" | "liga"

  try {
    // ===== FETCH ALL ClubProfiles with members =====
    const clubProfiles = await db.clubProfile.findMany({
      include: {
        members: {
          where: { leftAt: null }, // Only active members
          include: {
            player: {
              select: {
                id: true,
                gamertag: true,
                points: true,
                division: true,
              },
            },
          },
        },
        seasonEntries: {
          include: {
            season: {
              select: { id: true, number: true, division: true, status: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (clubProfiles.length === 0) {
      return NextResponse.json({ clubs: [], type }, { headers: LEADERBOARD_CACHE_HEADERS });
    }

    // ===== FOR TARKAM: Compute per-season points per player =====
    // Find the active season for each division and compute per-season points
    let seasonPointsMap = new Map<string, number>(); // playerId → per-season points

    if (type === 'tarkam') {
      // Find active season for male and female divisions
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

      // Get per-season points for all players in both divisions
      const seasonIds = [maleSeason?.id, femaleSeason?.id].filter(Boolean) as string[];
      if (seasonIds.length > 0) {
        const seasonPointsRaw = await db.playerPoint.groupBy({
          by: ['playerId'],
          where: { seasonId: { in: seasonIds } },
          _sum: { amount: true },
        });
        seasonPointsMap = new Map(seasonPointsRaw.map(sp => [sp.playerId, sp._sum.amount || 0]));
      }
    }

    // ===== FIND BEST SEASON FOR LIGA STATS =====
    const allSeasonNumbers = [...new Set(
      clubProfiles.flatMap(p =>
        p.seasonEntries.map(e => e.season.number)
      )
    )].sort((a, b) => b - a);

    let bestSeasonNumber = allSeasonNumbers[0] || 1;

    if (type === 'liga' && allSeasonNumbers.length > 0) {
      bestSeasonNumber = allSeasonNumbers[0];
    }

    // ===== BUILD LEADERBOARD =====
    const leaderboardClubs: LeaderboardClub[] = [];

    for (const profile of clubProfiles) {
      const activeMembers = profile.members;
      const maleMembers = activeMembers.filter(m => m.player.division === 'male');
      const femaleMembers = activeMembers.filter(m => m.player.division === 'female');

      let points: number;
      let totalWins = 0;
      let totalLosses = 0;
      let totalGameDiff = 0;

      if (type === 'tarkam') {
        // Tarkam: Club points = sum of all active member per-season points
        const malePoints = maleMembers.reduce((sum, m) => sum + (seasonPointsMap.get(m.player.id) || 0), 0);
        const femalePoints = femaleMembers.reduce((sum, m) => sum + (seasonPointsMap.get(m.player.id) || 0), 0);
        points = malePoints + femalePoints;

        leaderboardClubs.push({
          id: profile.id,
          name: profile.name,
          logo: profile.logo,
          bannerImage: profile.bannerImage,
          points,
          malePoints,
          femalePoints,
          wins: totalWins,
          losses: totalLosses,
          gameDiff: totalGameDiff,
          memberCount: activeMembers.length,
          maleMemberCount: maleMembers.length,
          femaleMemberCount: femaleMembers.length,
          rank: 0,
        });
      } else {
        // Liga: Club points = sum of season entry stats for the best season
        const seasonEntries = profile.seasonEntries.filter(
          e => e.season.number === bestSeasonNumber
        );

        for (const entry of seasonEntries) {
          totalWins += entry.wins;
          totalLosses += entry.losses;
          totalGameDiff += entry.gameDiff;
        }
        points = seasonEntries.reduce((sum, e) => sum + e.points, 0);

        // For Liga, male/female points come from season entries
        const malePoints = seasonEntries.filter(e => e.season.division === 'male').reduce((sum, e) => sum + e.points, 0);
        const femalePoints = seasonEntries.filter(e => e.season.division === 'female').reduce((sum, e) => sum + e.points, 0);

        leaderboardClubs.push({
          id: profile.id,
          name: profile.name,
          logo: profile.logo,
          bannerImage: profile.bannerImage,
          points,
          malePoints,
          femalePoints,
          wins: totalWins,
          losses: totalLosses,
          gameDiff: totalGameDiff,
          memberCount: activeMembers.length,
          maleMemberCount: maleMembers.length,
          femaleMemberCount: femaleMembers.length,
          rank: 0,
        });
      }
    }

    // Sort by points desc, then wins desc
    leaderboardClubs.sort((a, b) => b.points - a.points || b.wins - a.wins);

    // Assign ranks
    for (let i = 0; i < leaderboardClubs.length; i++) {
      leaderboardClubs[i].rank = i + 1;
    }

    return NextResponse.json({ clubs: leaderboardClubs, type }, {
      headers: LEADERBOARD_CACHE_HEADERS,
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json({ clubs: [], type }, { headers: LEADERBOARD_CACHE_HEADERS });
  }
}
