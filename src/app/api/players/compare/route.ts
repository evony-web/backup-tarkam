import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = request.nextUrl;
  const player1Id = searchParams.get('player1')?.trim() || '';
  const player2Id = searchParams.get('player2')?.trim() || '';

  if (!player1Id || !player2Id) {
    return NextResponse.json(
      { error: 'Both player1 and player2 query params are required' },
      { headers,  status: 400 }
    );
  }

  if (player1Id === player2Id) {
    return NextResponse.json(
      { error: 'Cannot compare a player with themselves' },
      { headers,  status: 400 }
    );
  }

  // Fetch both players in parallel
  const [p1, p2] = await Promise.all([
    db.player.findUnique({
      where: { id: player1Id },
      include: {
        clubMembers: {
          where: { leftAt: null },
          include: {
            profile: {
              select: { id: true, name: true, logo: true },
            },
          },
          take: 1,
        },
        achievements: {
          include: {
            achievement: {
              select: { id: true, name: true, displayName: true, icon: true, tier: true, category: true },
            },
          },
          orderBy: { earnedAt: 'desc' },
          take: 10,
        },
      },
    }),
    db.player.findUnique({
      where: { id: player2Id },
      include: {
        clubMembers: {
          where: { leftAt: null },
          include: {
            profile: {
              select: { id: true, name: true, logo: true },
            },
          },
          take: 1,
        },
        achievements: {
          include: {
            achievement: {
              select: { id: true, name: true, displayName: true, icon: true, tier: true, category: true },
            },
          },
          orderBy: { earnedAt: 'desc' },
          take: 10,
        },
      },
    }),
  ]);

  if (!p1) {
    return NextResponse.json(
      { error: `Player with id ${player1Id} not found` },
      { headers,  status: 404 }
    );
  }

  if (!p2) {
    return NextResponse.json(
      { error: `Player with id ${player2Id} not found` },
      { headers,  status: 404 }
    );
  }

  // Get rank for each player within their division
  const divisions = [...new Set([p1.division, p2.division])];
  const rankMaps = await Promise.all(
    divisions.map(async (division) => {
      const players = await db.player.findMany({
        where: { division, isActive: true, registrationStatus: 'approved' },
        orderBy: { points: 'desc' },
        select: { id: true },
      });
      return { division, map: new Map(players.map((p, i) => [p.id, i + 1])) };
    })
  );

  const getRank = (playerId: string, division: string) => {
    const entry = rankMaps.find(r => r.division === division);
    return entry?.map.get(playerId) ?? 0;
  };

  // Helper to transform player data
  const transformPlayer = (p: NonNullable<typeof p1>) => {
    const clubMember = p.clubMembers[0];
    return {
      id: p.id,
      gamertag: p.gamertag,
      name: p.name,
      avatar: p.avatar,
      division: p.division,
      tier: p.tier,
      points: p.points,
      totalWins: p.totalWins,
      totalMvp: p.totalMvp,
      streak: p.streak,
      maxStreak: p.maxStreak,
      matches: p.matches,
      rank: getRank(p.id, p.division),
      club: clubMember?.profile ? { id: clubMember.profile.id, name: clubMember.profile.name, logo: clubMember.profile.logo } : null,
      achievements: p.achievements.map(a => ({
        id: a.achievement.id,
        name: a.achievement.name,
        displayName: a.achievement.displayName,
        icon: a.achievement.icon,
        tier: a.achievement.tier,
        category: a.achievement.category,
        earnedAt: a.earnedAt.toISOString(),
      })),
      // Computed tier score: S=3, A=2, B=1
      tierScore: p.tier === 'S' ? 3 : p.tier === 'A' ? 2 : 1,
    };
  };

  return NextResponse.json({
    player1: transformPlayer(p1),
    player2: transformPlayer(p2),
  }, { headers });
}
