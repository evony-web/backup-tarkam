import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/division-rivalry
 * Returns head-to-head stats between the top 2 players in each division
 */
export async function GET() {
  try {
    // Get top 2 male players
    const maleTop2 = await db.player.findMany({
      where: { division: 'male', isActive: true, registrationStatus: 'approved' },
      orderBy: [{ points: 'desc' }, { totalWins: 'desc' }],
      take: 2,
      include: {
        clubMembers: {
          where: { leftAt: null },
          take: 1,
          include: {
            profile: { select: { id: true, name: true, logo: true } },
          },
        },
      },
    });

    // Get top 2 female players
    const femaleTop2 = await db.player.findMany({
      where: { division: 'female', isActive: true, registrationStatus: 'approved' },
      orderBy: [{ points: 'desc' }, { totalWins: 'desc' }],
      take: 2,
      include: {
        clubMembers: {
          where: { leftAt: null },
          take: 1,
          include: {
            profile: { select: { id: true, name: true, logo: true } },
          },
        },
      },
    });

    const formatRival = (p: typeof maleTop2[0]) => ({
      id: p.id,
      gamertag: p.gamertag,
      avatar: p.avatar,
      tier: p.tier,
      points: p.points,
      totalWins: p.totalWins,
      totalMvp: p.totalMvp,
      streak: p.streak,
      maxStreak: p.maxStreak,
      matches: p.matches,
      club: p.clubMembers?.[0]?.profile ? { name: p.clubMembers[0].profile.name, logo: p.clubMembers[0].profile.logo } : null,
    });

    // Count total players per division
    const maleCount = await db.player.count({ where: { division: 'male', isActive: true, registrationStatus: 'approved' } });
    const femaleCount = await db.player.count({ where: { division: 'female', isActive: true, registrationStatus: 'approved' } });

    return NextResponse.json({
      male: maleTop2.length >= 2 ? {
        player1: formatRival(maleTop2[0]),
        player2: formatRival(maleTop2[1]),
        totalPlayers: maleCount,
        pointDiff: maleTop2[0].points - maleTop2[1].points,
      } : null,
      female: femaleTop2.length >= 2 ? {
        player1: formatRival(femaleTop2[0]),
        player2: formatRival(femaleTop2[1]),
        totalPlayers: femaleCount,
        pointDiff: femaleTop2[0].points - femaleTop2[1].points,
      } : null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Surrogate-Key': 'league-data',
      },
    });
  } catch {
    return NextResponse.json({ male: null, female: null });
  }
}
