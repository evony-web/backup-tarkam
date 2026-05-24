'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Lock } from 'lucide-react';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import type { StatsData } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   COMMUNITY ACHIEVEMENTS — Collective badges/milestones
   ═══════════════════════════════════════════════════════ */
interface CommunityAchievementsProps {
  maleData?: StatsData;
  femaleData?: StatsData;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0–100
}

export function CommunityAchievements({ maleData, femaleData }: CommunityAchievementsProps) {
  const dt = useCommunityTheme();

  const achievements = useMemo(() => {
    const totalPlayers = (maleData?.totalPlayers || 0) + (femaleData?.totalPlayers || 0);
    const totalMatches = (maleData?.recentMatches?.length || 0) + (femaleData?.recentMatches?.length || 0);
    const totalClubs = (maleData?.clubs?.length || 0) + (femaleData?.clubs?.length || 0);
    const completedMatches = 0;
    const donationTotal = (maleData?.seasonDonationTotal || 0) + (femaleData?.seasonDonationTotal || 0);

    // Check if any season has a champion
    const hasChampion = [...(maleData?.allSeasons || []), ...(femaleData?.allSeasons || [])].some(
      (s) => s.championPlayer !== null
    );

    // Check streak >= 5 across all top players
    const allPlayers = [...(maleData?.topPlayers || []), ...(femaleData?.topPlayers || [])];
    const hasStreak5 = allPlayers.some((p) => p.streak >= 5);
    const maxStreak = Math.max(0, ...allPlayers.map((p) => p.streak));

    // MVP Hall of Fame check
    const mvpEntries = [
      ...(maleData?.mvpHallOfFame || []),
      ...(femaleData?.mvpHallOfFame || []),
    ];
    const hasMvpHall = mvpEntries.length > 0;

    // Win rate calculation
    const totalWins = allPlayers.reduce((s, p) => s + p.totalWins, 0);
    const totalPlayerMatches = allPlayers.reduce((s, p) => s + p.matches, 0);
    const winRate = totalPlayerMatches > 0 ? Math.round((totalWins / totalPlayerMatches) * 100) : 0;

    const list: Achievement[] = [
      {
        id: '100-matches',
        icon: '🎮',
        title: '100 Match Terlaksana',
        description: `${totalMatches} pertandingan`,
        unlocked: totalMatches >= 100,
        progress: Math.min(100, Math.round((totalMatches / 100) * 100)),
      },
      {
        id: '50-players',
        icon: '👥',
        title: '50 Player Aktif',
        description: `${totalPlayers} pemain`,
        unlocked: totalPlayers >= 50,
        progress: Math.min(100, Math.round((totalPlayers / 50) * 100)),
      },
      {
        id: 'season-champion',
        icon: '🏆',
        title: 'Juara Tarkam Terpilih',
        description: hasChampion ? 'Champion terpilih' : 'Belum ada champion',
        unlocked: hasChampion,
        progress: hasChampion ? 100 : 0,
      },
      {
        id: 'streak-5',
        icon: '🔥',
        title: 'Streak 5+',
        description: `Max streak: ${maxStreak}`,
        unlocked: hasStreak5,
        progress: Math.min(100, Math.round((maxStreak / 5) * 100)),
      },
      {
        id: 'donation-1m',
        icon: '💰',
        title: 'Donasi 1Juta+',
        description: `Total: Rp. ${donationTotal >= 1_000_000 ? (donationTotal / 1_000_000).toFixed(1) + 'M' : (donationTotal / 1_000).toFixed(0) + 'K'}`,
        unlocked: donationTotal >= 1_000_000,
        progress: Math.min(100, Math.round((donationTotal / 1_000_000) * 100)),
      },
      {
        id: '10-clubs',
        icon: '🏅',
        title: '10 Klub Terdaftar',
        description: `${totalClubs} klub`,
        unlocked: totalClubs >= 10,
        progress: Math.min(100, Math.round((totalClubs / 10) * 100)),
      },
      {
        id: 'mvp-hall',
        icon: '⭐',
        title: 'MVP Hall of Fame',
        description: `${mvpEntries.length} entri`,
        unlocked: hasMvpHall,
        progress: mvpEntries.length > 0 ? 100 : 0,
      },
      {
        id: 'winrate-60',
        icon: '🎯',
        title: 'Win Rate 60%+',
        description: `Rate: ${winRate}%`,
        unlocked: winRate >= 60,
        progress: Math.min(100, Math.round((winRate / 60) * 100)),
      },
    ];

    return list;
  }, [maleData, femaleData]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="animate-fade-enter">
      <Card className={`${dt.casinoCard} overflow-hidden`}>
        <div className={dt.casinoBar} />

        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Award className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Pencapaian Komunitas</h3>
          <Badge className={`ml-auto ${dt.casinoBadge} text-[9px]`}>
            {unlockedCount}/{achievements.length}
          </Badge>
        </div>

        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {achievements.map((ach, i) => (
                <div
                  key={ach.id}
                  className={`relative p-3 sm:p-4 rounded-2xl border transition-all duration-300 animate-fade-enter-sm ${
                    ach.unlocked
                      ? `${dt.bgSubtle} ${dt.borderSubtle}`
                      : 'bg-muted/5 border-border/10 opacity-60'
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                {/* Glow effect for unlocked */}
                {ach.unlocked && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse-scale"
                    style={{ boxShadow: '0 0 8px rgba(239,249,35,0.15)' }}
                  />
                )}

                {/* Icon + Status */}
                <div className="flex items-start justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                      ach.unlocked
                        ? 'bg-idm-gold-warm/15 ring-1 ring-idm-gold-warm/20'
                        : 'bg-muted/10'
                    }`}
                  >
                    {ach.icon}
                  </div>
                  <span className="text-[10px]">
                    {ach.unlocked ? '✅' : <Lock className="w-3 h-3 text-muted-foreground/40" />}
                  </span>
                </div>

                {/* Title */}
                <p
                  className={`text-[11px] font-bold leading-tight mb-0.5 ${
                    ach.unlocked ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {ach.title}
                </p>

                {/* Description */}
                <p className="text-[9px] text-muted-foreground/70 mb-2">{ach.description}</p>

                {/* Progress bar */}
                {!ach.unlocked && ach.progress > 0 && (
                  <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-idm-gold-warm/40"
                      style={{ width: `${ach.progress}%` }}
                    />
                  </div>
                )}
                {ach.unlocked && (
                  <div className="h-1 rounded-full bg-idm-gold-warm/20 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-idm-gold-warm to-amber-500" />
                  </div>
                )}
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
