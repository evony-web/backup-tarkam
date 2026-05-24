'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Crown, Trophy, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivisionTheme, getDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

/* ─── Types ─── */
interface StreakPlayer {
  id: string;
  gamertag: string;
  avatar: string | null;
  tier: string;
  streak: number;
  maxStreak: number;
  club: string | null;
}

interface StreaksData {
  streaks: StreakPlayer[];
}

type DivisionFilter = 'all' | 'semua' | 'male' | 'female';

interface StreakWidgetProps {
  selectedDivision?: DivisionFilter;
}

/* ─── Flame intensity component ─── */
function FlameIcon({ streak, className }: { streak: number; className?: string }) {
  const intensity = Math.min(streak, 10);
  const scale = 1 + intensity * 0.05;
  const colorClass = intensity >= 7
    ? 'text-red-500'
    : intensity >= 4
      ? 'text-orange-400'
      : 'text-amber-400';

  return (
    <Flame
      className={`${colorClass} ${className || ''}`}
      style={{
        transform: `scale(${scale})`,
        filter: intensity >= 5 ? `drop-shadow(0 0 ${intensity * 2}px currentColor)` : 'none',
        transition: 'transform 0.3s ease, filter 0.3s ease',
      }}
    />
  );
}

/* ─── Loading skeleton ─── */
function LoadingSkeleton({ dt: dtProp }: { dt?: ReturnType<typeof getDivisionTheme> }) {
  const dtHook = useDivisionTheme();
  const dt = dtProp || dtHook;

  return (
    <Card className={`${dt.casinoCard} overflow-hidden h-full flex flex-col`}>
      <div className={dt.casinoBar} />
      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="h-8 w-12 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-16 rounded flex-1" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   Single Division Streak Card
   ═══════════════════════════════════════════════════════ */
function SingleDivisionStreakCard({
  division,
  showDivisionLabel,
}: {
  division: 'male' | 'female';
  showDivisionLabel?: boolean;
}) {
  const dt = getDivisionTheme(division);

  const { data, isLoading } = useQuery<StreaksData>({
    queryKey: ['player-streaks', division],
    queryFn: async () => {
      const res = await fetch(`/api/players/streaks?division=${division}`);
      if (!res.ok) throw new Error('Failed to fetch streaks');
      return res.json();
    },
    staleTime: 30000,
  });

  if (isLoading) return <LoadingSkeleton dt={dt} />;

  const streaks = data?.streaks ?? [];

  /* ─── Empty state ─── */
  if (streaks.length === 0) {
    return (
      <Card className={`${dt.casinoCard} overflow-hidden h-full flex flex-col`}>
        <div className={dt.casinoBar} />
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle} shrink-0`}>
          <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
            <Flame className={`w-3 h-3 ${dt.neonText}`} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider">🔥 Streak Aktif</h3>
          {showDivisionLabel && (
            <Badge className={`${dt.badgeBg} text-[8px] border ml-1`}>
              {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </Badge>
          )}
        </div>
        <div className="p-4 text-center flex-1 flex flex-col items-center justify-center">
          <div className="relative inline-flex items-center justify-center mb-2">
            <Flame className="w-8 h-8 text-amber-400/30" />
          </div>
          <p className="text-xs text-muted-foreground/70 mb-1">
            Belum ada streak aktif
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            Menangkan pertandingan berturut-turut untuk memulai streak!
          </p>
        </div>
      </Card>
    );
  }

  const topStreak = streaks[0];
  const runnerUps = streaks.slice(1, 3);

  return (
    <Card className={`${dt.casinoCard} overflow-hidden h-full flex flex-col`}>
      <div className={dt.casinoBar} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle} shrink-0`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <FlameIcon streak={topStreak.streak} className="w-3 h-3" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">🔥 Streak Aktif</h3>
        {showDivisionLabel && (
          <Badge className={`${dt.badgeBg} text-[8px] border ml-1`}>
            {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
          </Badge>
        )}
        {topStreak.streak >= 5 && (
          <Badge className="bg-orange-500/15 text-orange-400 text-[9px] border-orange-500/20 px-1.5 py-0 h-4 ml-auto shrink-0">
            <Crown className="w-2.5 h-2.5 mr-0.5" />
            ON FIRE
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* ─── Top streak player — hero display ─── */}
        <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} relative overflow-hidden`}>
          {/* Animated flame glow background */}
          {topStreak.streak >= 3 && (
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(circle at 70% 50%, ${
                  topStreak.streak >= 7 ? '#ef4444' : topStreak.streak >= 5 ? '#f97316' : '#f59e0b'
                } 0%, transparent 70%)`,
              }}
            />
          )}

          {/* Avatar */}
          <div className="relative z-10">
            <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 ${
              topStreak.streak >= 5 ? 'border-orange-400/60' : 'border-idm-gold-warm/40'
            }`}>
              <AvatarMedia src={getAvatarUrl(topStreak.gamertag, division, topStreak.avatar)} alt={topStreak.gamertag} width={48} height={48} className="w-full h-full object-cover" loading="lazy" />
            </div>
            {/* Crown badge */}
            {topStreak.streak >= 3 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-md z-20">
                <Crown className="w-2.5 h-2.5 text-background" />
              </div>
            )}
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0 z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold truncate">{topStreak.gamertag}</span>
            </div>
            {clubToString(topStreak.club) && (
              <p className="text-[10px] text-muted-foreground/60 truncate">{clubToString(topStreak.club)}</p>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[9px] text-muted-foreground/50">Max: {topStreak.maxStreak}</span>
            </div>
          </div>

          {/* Streak number — animated flame */}
          <div className="flex flex-col items-center shrink-0 z-10">
            <FlameIcon streak={topStreak.streak} className="w-5 h-5 mb-0.5" />
            <span className={`text-lg font-black tabular-nums ${
              topStreak.streak >= 7 ? 'text-red-400' : topStreak.streak >= 4 ? 'text-orange-400' : 'text-amber-400'
            }`}>
              {topStreak.streak}
            </span>
            <span className="text-[8px] text-muted-foreground/50 uppercase">streak</span>
          </div>
        </div>

        {/* ─── Mini leaderboard: Top 3 ─── */}
        {runnerUps.length > 0 && (
          <div className="space-y-1">
            {runnerUps.map((player, i) => (
              <div
                key={player.id}
                className={`flex items-center gap-2 p-1.5 rounded-lg ${i % 2 === 0 ? dt.bgSubtle : ''} transition-colors`}
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
              >
                {/* Rank number */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  i === 0
                    ? 'bg-gray-400/20 text-muted-foreground'
                    : 'bg-amber-600/20 text-amber-300'
                }`}>
                  {i + 2}
                </div>

                {/* Avatar */}
                <div className="w-6 h-6 rounded-full overflow-hidden border border-border/30 shrink-0">
                  <AvatarMedia src={getAvatarUrl(player.gamertag, division, player.avatar)} alt={player.gamertag} width={24} height={24} className="w-full h-full object-cover" loading="lazy" />
                </div>

                {/* Name + club */}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold truncate">{player.gamertag}</span>
                  {clubToString(player.club) && (
                    <span className="text-[9px] text-muted-foreground/50 ml-1">{clubToString(player.club)}</span>
                  )}
                </div>

                {/* Streak badge */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Flame className="w-2.5 h-2.5 text-amber-400/70" />
                  <span className="text-[11px] font-bold text-amber-400 tabular-nums">{player.streak}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}


/* ═══════════════════════════════════════════════════════
   Main Widget — renders single or dual streak based on selectedDivision
   ═══════════════════════════════════════════════════════ */
export function StreakWidget({ selectedDivision }: StreakWidgetProps) {
  const storeDivision = useAppStore((s) => s.division);
  const effectiveFilter: DivisionFilter = selectedDivision ?? storeDivision ?? 'all';

  /* ─── "Semua" — Show both divisions side by side ─── */
  if (effectiveFilter === 'all') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SingleDivisionStreakCard division="male" showDivisionLabel />
        <SingleDivisionStreakCard division="female" showDivisionLabel />
      </div>
    );
  }

  /* ─── Single division ─── */
  const division: 'male' | 'female' = effectiveFilter === 'female' ? 'female' : 'male';

  return (
    <SingleDivisionStreakCard
      division={division}
      showDivisionLabel={false}
    />
  );
}
