import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/clubs/unified-profile?clubId=xxx
 *
 * Given a club ID (Club or ClubProfile), return the unified profile with
 * combined members, stats, and division info.
 *
 * Clubs in IDM League are unified entities — a single ClubProfile has
 * members from both male and female divisions, with season-specific
 * stats in Club entries.
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'clubId is required' }, { headers,  status: 400 });
  }

  // Resolve to ClubProfile
  let profileId = clubId;

  const profile = await db.clubProfile.findUnique({
    where: { id: clubId },
  });

  if (!profile) {
    // Maybe it's a Club ID — look up the profile
    const club = await db.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { headers,  status: 404 });
    }

    profileId = club.profileId;
  }

  // Fetch the full ClubProfile with members and season entries
  const fullProfile = await db.clubProfile.findUnique({
    where: { id: profileId },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          player: {
            select: {
              id: true,
              gamertag: true,
              name: true,
              division: true,
              avatar: true,
              tier: true,
              points: true,
              totalWins: true,
              totalMvp: true,
              streak: true,
              maxStreak: true,
              matches: true,
              isActive: true,
              city: true,
            },
          },
        },
        orderBy: [
          { role: 'desc' }, // captains first
          { player: { gamertag: 'asc' } },
        ],
      },
      seasonEntries: {
        include: {
          season: { select: { id: true, name: true, number: true, division: true } },
        },
      },
    },
  });

  if (!fullProfile) {
    return NextResponse.json({ error: 'Club profile tidak ditemukan' }, { headers,  status: 404 });
  }

  const sameNameClubs = fullProfile.seasonEntries;
  const divisions = [...new Set(sameNameClubs.map(c => c.division))];

  // Combine stats from all season entries
  const totalWins = sameNameClubs.reduce((sum, c) => sum + c.wins, 0);
  const totalLosses = sameNameClubs.reduce((sum, c) => sum + c.losses, 0);
  const totalPoints = sameNameClubs.reduce((sum, c) => sum + c.points, 0);
  const totalGameDiff = sameNameClubs.reduce((sum, c) => sum + c.gameDiff, 0);

  // Count members per division
  const maleMembers = fullProfile.members.filter(m => m.player.division === 'male').length;
  const femaleMembers = fullProfile.members.filter(m => m.player.division === 'female').length;

  // Get per-season player points for all club members (to avoid stale Player.points)
  const memberPlayerIds = fullProfile.members.map(m => m.player.id);
  const activeSeasonIds = sameNameClubs.map(c => c.seasonId).filter(Boolean) as string[];

  let seasonPointsMap = new Map<string, number>();
  if (memberPlayerIds.length > 0 && activeSeasonIds.length > 0) {
    const playerSeasonPoints = await db.playerPoint.groupBy({
      by: ['playerId'],
      where: {
        playerId: { in: memberPlayerIds },
        seasonId: { in: activeSeasonIds },
      },
      _sum: { amount: true },
    });
    for (const row of playerSeasonPoints) {
      if (row.playerId && row._sum.amount) {
        seasonPointsMap.set(row.playerId, row._sum.amount);
      }
    }
  }

  // Tarkam mode: compute per-division points from PlayerPoint aggregation
  const maleMemberPoints = fullProfile.members
    .filter(m => m.player.division === 'male')
    .reduce((sum, m) => sum + (seasonPointsMap.get(m.player.id) || 0), 0);
  const femaleMemberPoints = fullProfile.members
    .filter(m => m.player.division === 'female')
    .reduce((sum, m) => sum + (seasonPointsMap.get(m.player.id) || 0), 0);
  const tarkamPoints = maleMemberPoints + femaleMemberPoints;

  // Tarkam mode: no club champion seasons (that's Liga IDM)
  const championSeasons: any[] = [];

  return NextResponse.json({
    id: profileId,
    name: fullProfile.name,
    logo: fullProfile.logo,
    bannerImage: fullProfile.bannerImage,
    // Unified stats across all divisions (Liga-style)
    wins: totalWins,
    losses: totalLosses,
    points: tarkamPoints || totalPoints, // Prefer Tarkam points when available
    gameDiff: totalGameDiff,
    // Tarkam per-division points breakdown
    malePoints: maleMemberPoints,
    femalePoints: femaleMemberPoints,
    // Division info
    divisions,
    hasMaleDivision: divisions.includes('male'),
    hasFemaleDivision: divisions.includes('female'),
    maleMembers,
    femaleMembers,
    // Club IDs per division for reference
    clubIds: sameNameClubs.map(c => ({ id: c.id, division: c.division })),
    // Members with division info — use per-season points when available
    members: fullProfile.members.map(m => ({
      id: m.player.id,
      gamertag: m.player.gamertag,
      name: m.player.name,
      division: m.player.division,
      avatar: m.player.avatar,
      tier: m.player.tier,
      points: seasonPointsMap.get(m.player.id) ?? m.player.points,
      totalWins: m.player.totalWins,
      totalMvp: m.player.totalMvp,
      streak: m.player.streak,
      maxStreak: m.player.maxStreak,
      matches: m.player.matches,
      isActive: m.player.isActive,
      role: m.role,
      city: m.player.city,
    })),
    // Per-division stats breakdown
    divisionStats: sameNameClubs.map(c => ({
      division: c.division,
      wins: c.wins,
      losses: c.losses,
      points: c.points,
      gameDiff: c.gameDiff,
      season: c.season,
    })),
    // League champion seasons
    championSeasons,
  }, { headers });
}
