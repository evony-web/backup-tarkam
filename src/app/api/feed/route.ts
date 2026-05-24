import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export interface FeedItem {
  id: string;
  type: 'transfer' | 'donation' | 'score' | 'champion' | 'mvp' | 'registration' | 'tournament_signup';
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
  division?: string;
  accent: string; // tailwind color class or hex
}

export async function GET() {
  const feedItems: FeedItem[] = [];

  // Run all queries in parallel
  const [
    recentDonations,
    recentCompletedMatches,
    recentChampionTournaments,
    recentMvpPlayers,
    recentClubMembers,
    recentRegistrations,
    recentParticipations,
  ] = await Promise.all([
    // Latest approved donations
    db.donation.findMany({
      where: { amount: { gt: 0 }, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),

    // Latest completed matches (Tarkam: tournament matches)
    // Only show matches from tournaments in main_event or later status
    db.match.findMany({
      where: { status: 'completed', score1: { not: null }, score2: { not: null }, tournament: { status: { in: ['main_event', 'finalization', 'completed'] } } },
      orderBy: { completedAt: 'desc' },
      take: 8,
      include: { team1: true, team2: true, mvpPlayer: true, tournament: { select: { weekNumber: true, division: true } } },
    }),

    // Latest completed tournaments with winner
    db.tournament.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 4,
      include: {
        teams: { where: { isWinner: true }, take: 1 },
      },
    }),

    // Recent MVPs
    db.match.findMany({
      where: { mvpPlayerId: { not: null }, status: 'completed', tournament: { status: { in: ['main_event', 'finalization', 'completed'] } } },
      orderBy: { completedAt: 'desc' },
      take: 5,
      include: { mvpPlayer: true, tournament: true },
    }),

    // Recent club member changes (transfers / new members)
    db.clubMember.findMany({
      orderBy: { joinedAt: 'desc' },
      take: 10,
      include: {
        player: true,
        profile: true,
      },
    }),

    // Recent player registrations (include pending AND approved, exclude soft-deleted)
    db.player.findMany({
      where: { isActive: true, registrationStatus: { in: ['pending', 'approved'] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),

    // Recent tournament sign-ups (participations)
    db.participation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        player: true,
        tournament: { select: { name: true, weekNumber: true, division: true, status: true } },
      },
    }),
  ]);

  // ─── Donations ───
  for (const d of recentDonations) {
    feedItems.push({
      id: `don-${d.id}`,
      type: 'donation',
      icon: '💰',
      title: `${d.donorName} menyawer ${formatRupiah(d.amount)}`,
      subtitle: d.message || (d.type === 'season' ? 'Donasi Season' : 'Donasi Weekly'),
      timestamp: d.createdAt.toISOString(),
      accent: '#22c55e',
    });
  }

  // ─── Completed Match Scores (Tarkam tournament matches) ───
  for (const m of recentCompletedMatches) {
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;
    const c1name = (m.team1 as any)?.name || '?';
    const c2name = (m.team2 as any)?.name || '?';
    const winner = s1 > s2 ? c1name : s2 > s1 ? c2name : 'Seri';
    feedItems.push({
      id: `score-${m.id}`,
      type: 'score',
      icon: '⚽',
      title: `${c1name} ${s1}–${s2} ${c2name}`,
      subtitle: `Week ${(m.tournament as any)?.weekNumber || '?'} • ${winner !== 'Seri' ? winner + ' menang!' : 'Seri!'}`,
      timestamp: m.completedAt?.toISOString() || new Date().toISOString(),
      division: (m.tournament as any)?.division,
      accent: '#2E9FFF',
    });
  }

  // ─── Champions ───
  for (const t of recentChampionTournaments) {
    const winnerTeam = t.teams.find(team => team.isWinner);
    if (winnerTeam) {
      feedItems.push({
        id: `champ-${t.id}`,
        type: 'champion',
        icon: '🏆',
        title: `${winnerTeam.name} Juara Week ${t.weekNumber}!`,
        subtitle: t.division === 'male' ? 'Divisi Cowo' : 'Divisi Cewe',
        timestamp: t.completedAt?.toISOString() || t.updatedAt.toISOString(),
        division: t.division,
        accent: '#EFF923',
      });
    }
  }

  // ─── MVP ───
  for (const match of recentMvpPlayers) {
    if (match.mvpPlayer) {
      feedItems.push({
        id: `mvp-${match.id}`,
        type: 'mvp',
        icon: '⭐',
        title: `${match.mvpPlayer.gamertag} MVP!`,
        subtitle: match.tournament?.name || 'Tarkam',
        timestamp: match.completedAt?.toISOString() || new Date().toISOString(),
        division: match.mvpPlayer.division,
        accent: '#eab308',
      });
    }
  }

  // ─── Transfers (club member assignments) ───
  // Group by player to detect "transfers" — if a player appears in multiple clubs
  const playerClubMap = new Map<string, { player: typeof recentClubMembers[0]['player']; clubs: string[] }>();
  for (const cm of recentClubMembers) {
      const existing = playerClubMap.get(cm.player.id);
    if (existing) {
      existing.clubs.push(cm.profile.name);
    } else {
      playerClubMap.set(cm.player.id, { player: cm.player, clubs: [cm.profile.name] });
    }
  }

  for (const [, { player, clubs }] of playerClubMap) {
    if (clubs.length >= 2) {
      // Transfer: player moved from one club to another
      feedItems.push({
        id: `transfer-${player.id}`,
        type: 'transfer',
        icon: '🔄',
        title: `${player.gamertag} pindah ke ${clubs[clubs.length - 1]}`,
        subtitle: `Dari ${clubs[clubs.length - 2]} → ${clubs[clubs.length - 1]}`,
        timestamp: player.updatedAt.toISOString(),
        division: player.division,
        accent: '#FF2D78',
      });
    } else {
      // New signing
      feedItems.push({
        id: `sign-${player.id}`,
        type: 'transfer',
        icon: '📝',
        title: `${player.gamertag} bergabung dengan ${clubs[0]}`,
        subtitle: `${player.division === 'male' ? 'Divisi Cowo' : 'Divisi Cewe'}`,
        timestamp: player.updatedAt.toISOString(),
        division: player.division,
        accent: '#FF2D78',
      });
    }
  }

  // ─── New Registrations (pending + approved) ───
  for (const p of recentRegistrations) {
    const statusLabel = p.registrationStatus === 'pending' ? 'menunggu approval' : 'disetujui';
    feedItems.push({
      id: `reg-${p.id}`,
      type: 'registration',
      icon: p.registrationStatus === 'pending' ? '🆕' : '✅',
      title: `${p.gamertag} mendaftar sebagai pemain`,
      subtitle: `${p.division === 'male' ? 'Divisi Cowo' : 'Divisi Cewe'} • ${statusLabel}${p.city ? ' • ' + p.city : ''}`,
      timestamp: p.createdAt.toISOString(),
      division: p.division,
      accent: p.registrationStatus === 'pending' ? '#57B5FF' : '#22c55e',
    });
  }

  // ─── Tournament Sign-ups (participations) ───
  for (const part of recentParticipations) {
    const t = part.tournament;
    const player = part.player;
    // Skip if this player already has a registration entry with same timestamp
    // (avoid duplicate "mendaftar" entries)
    const isDuplicate = recentRegistrations.some(
      r => r.id === player.id && Math.abs(r.createdAt.getTime() - part.createdAt.getTime()) < 5000
    );
    if (isDuplicate) continue;

    const statusLabel = part.status === 'pending' ? 'menunggu approval' :
                        part.status === 'approved' ? 'disetujui' :
                        part.status === 'rejected' ? 'ditolak' : part.status;

    feedItems.push({
      id: `tsign-${part.id}`,
      type: 'tournament_signup',
      icon: '🎮',
      title: `${player.gamertag} mendaftar turnamen`,
      subtitle: `Week ${t?.weekNumber || '?'} • ${t?.division === 'male' ? 'Cowo' : 'Cewe'} • ${statusLabel}`,
      timestamp: part.createdAt.toISOString(),
      division: t?.division || player.division,
      accent: '#f59e0b',
    });
  }

  // Sort by timestamp descending
  feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ items: feedItems.slice(0, 30) }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Surrogate-Key': 'feed',
      'Vary': 'Accept-Encoding',
    },
  });
}

function formatRupiah(amount: number): string {
  if (amount >= 1000000) return `Rp${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp${(amount / 1000).toFixed(0)}rb`;
  return `Rp${amount}`;
}
