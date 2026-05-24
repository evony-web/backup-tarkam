import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ActivityItem {
  id: string;
  type: 'registration' | 'match_result' | 'donation' | 'achievement';
  title: string;
  description: string;
  icon: string;
  timestamp: string;
  division?: string;
}

function formatRupiah(amount: number): string {
  if (amount >= 1000000) return `Rp${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp${(amount / 1000).toFixed(0)}rb`;
  return `Rp${amount}`;
}

export async function GET() {
  const activities: ActivityItem[] = [];

  // Run all queries in parallel for performance
  const [
    recentRegistrations,
    recentMatchResults,
    recentDonations,
    recentAchievements,
  ] = await Promise.all([
    // Recent player registrations (exclude soft-deleted)
    db.player.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        gamertag: true,
        division: true,
        createdAt: true,
      },
    }),

    // Recent completed matches (tournament bracket matches)
    db.match.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        team1: { select: { name: true } },
        team2: { select: { name: true } },
        tournament: { select: { name: true, division: true } },
      },
    }),

    // Recent approved donations
    db.donation.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Recent achievement awards
    db.playerAchievement.findMany({
      orderBy: { earnedAt: 'desc' },
      take: 10,
      include: {
        player: { select: { gamertag: true, division: true } },
        achievement: { select: { displayName: true, icon: true } },
      },
    }),
  ]);

  // ─── Player Registrations ───
  for (const p of recentRegistrations) {
    activities.push({
      id: `reg-${p.id}`,
      type: 'registration',
      title: 'Pemain Baru Bergabung',
      description: `${p.gamertag} bergabung di tarkam`,
      icon: '\u{1F44B}',
      timestamp: p.createdAt.toISOString(),
      division: p.division,
    });
  }

  // ─── Match Results ───
  for (const m of recentMatchResults) {
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;
    const team1Name = m.team1?.name || 'TBD';
    const team2Name = m.team2?.name || 'TBD';

    activities.push({
      id: `match-${m.id}`,
      type: 'match_result',
      title: 'Pertandingan Selesai',
      description: `${team1Name} ${s1}-${s2} ${team2Name}`,
      icon: '\u2694\uFE0F',
      timestamp: m.completedAt?.toISOString() || m.createdAt.toISOString(),
      division: m.tournament?.division,
    });
  }

  // ─── Donations ───
  for (const d of recentDonations) {
    activities.push({
      id: `don-${d.id}`,
      type: 'donation',
      title: 'Donasi Diterima',
      description: `${d.donorName} menyawer ${formatRupiah(d.amount)}`,
      icon: '\u2764\uFE0F',
      timestamp: d.createdAt.toISOString(),
    });
  }

  // ─── Achievement Awards ───
  for (const a of recentAchievements) {
    activities.push({
      id: `ach-${a.id}`,
      type: 'achievement',
      title: 'Pencapaian Baru',
      description: `${a.player.gamertag} mendapat ${a.achievement.displayName}`,
      icon: a.achievement.icon || '\u{1F3C6}',
      timestamp: a.earnedAt.toISOString(),
      division: a.player.division,
    });
  }

  // Sort all activities by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Limit to 20 most recent
  const limited = activities.slice(0, 20);

  return NextResponse.json(
    { activities: limited },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'Surrogate-Key': 'activity',
        'Vary': 'Accept-Encoding',
      },
    }
  );
}
