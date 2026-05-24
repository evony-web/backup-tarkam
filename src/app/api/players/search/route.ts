import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim() || '';
  const division = searchParams.get('division') || 'male';

  if (!q) {
    return NextResponse.json({ players: [] }, { headers });
  }

  // Search by gamertag or name (case-insensitive, partial match)
  const players = await db.player.findMany({
    where: {
      division,
      isActive: true,
      registrationStatus: 'approved',
      OR: [
        { gamertag: { contains: q } },
        { name: { contains: q } },
      ],
    },
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
    },
    orderBy: { points: 'desc' },
    take: 20,
  });

  // Get rank for each player within their division
  const divisionPlayers = await db.player.findMany({
    where: { division, isActive: true, registrationStatus: 'approved' },
    orderBy: { points: 'desc' },
    select: { id: true },
  });
  const rankMap = new Map(divisionPlayers.map((p, i) => [p.id, i + 1]));

  const result = players.map(p => {
    const clubMember = p.clubMembers[0]; // first active club membership
    return {
      id: p.id,
      gamertag: p.gamertag,
      division: p.division,
      tier: p.tier,
      points: p.points,
      totalWins: p.totalWins,
      totalMvp: p.totalMvp,
      avatar: p.avatar,
      club: clubMember?.profile ? { id: clubMember.profile.id, name: clubMember.profile.name, logo: clubMember.profile.logo } : null,
      rank: rankMap.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({ players: result }, { headers });
}
