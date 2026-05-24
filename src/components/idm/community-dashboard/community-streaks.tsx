'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Crown, Trophy, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
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

interface MergedStreakPlayer extends StreakPlayer {
  division: 'male' | 'female';
}

/* ═══════════════════════════════════════════
   Flame intensity component (mirrors StreakWidget)
   ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   Get flame color class based on streak value
   amber (< 3), orange (3-5), red (> 5)
   ═══════════════════════════════════════════ */
function getStreakColor(streak: number): string {
  if (streak > 5) return 'text-red-400';
  if (streak >= 3) return 'text-orange-400';
  return 'text-amber-400';
}

function getStreakGlowColor(streak: number): string {
  if (streak > 5) return '#ef4444';
  if (streak >= 3) return '#f97316';
  return '#f59e0b';
}

type DivisionFilter = 'all' | 'male' | 'female';

interface CommunityStreaksProps {
  selectedDivision?: DivisionFilter;
}

/* ═══════════════════════════════════════════
   Main Component — Community Streaks
   ═══════════════════════════════════════════ */
export function CommunityStreaks({ selectedDivision = 'all' }: CommunityStreaksProps) {
  const ct = useCommunityTheme(); // Gold theme for the outer card

  // Fetch male streaks
  const { data: maleData, isLoading: isMaleLoading } = useQuery<StreaksData>({
    queryKey: ['player-streaks', 'male'],
    queryFn: async () => {
      const res = await fetch('/api/players/streaks?division=male');
      if (!res.ok) throw new Error('Failed to fetch male streaks');
      return res.json();
    },
    staleTime: 30000,
  });

  // Fetch female streaks
  const { data: femaleData, isLoading: isFemaleLoading } = useQuery<StreaksData>({
    queryKey: ['player-streaks', 'female'],
    queryFn: async () => {
      const res = await fetch('/api/players/streaks?division=female');
      if (!res.ok) throw new Error('Failed to fetch female streaks');
      return res.json();
    },
    staleTime: 30000,
  });

  const isLoading = isMaleLoading || isFemaleLoading;

  // Merge and sort by streak descending, filter by selected division
  const mergedStreaks: MergedStreakPlayer[] = React.useMemo(() => {
    const male = selectedDivision === 'all' || selectedDivision === 'male'
      ? (maleData?.streaks || []).map((p) => ({ ...p, division: 'male' as const }))
      : [];
    const female = selectedDivision === 'all' || selectedDivision === 'female'
      ? (femaleData?.streaks || []).map((p) => ({ ...p, division: 'female' as const }))
      : [];
    return [...male, ...female].sort((a, b) => b.streak - a.streak).slice(0, 5);
  }, [maleData, femaleData, selectedDivision]);

  /* ─── Loading skeleton ─── */
  if (isLoading) {
    return (
      <Card className={`${ct.casinoCard} overflow-hidden`}>
        <div className={ct.casinoBar} />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted/20 animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted/20 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg">
            <div className="w-12 h-12 rounded-2xl bg-muted/15 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-24 rounded bg-muted/15 animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted/15 animate-pulse" />
            </div>
            <div className="h-8 w-12 rounded-lg bg-muted/15 animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-muted/15 animate-pulse shrink-0" />
              <div className="h-3 w-20 rounded bg-muted/15 animate-pulse flex-1" />
              <div className="h-3 w-8 rounded bg-muted/15 animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  /* ─── Empty state ─── */
  if (mergedStreaks.length === 0) {
    return (
      <Card className={`${ct.casinoCard} overflow-hidden`}>
        <div className={ct.casinoBar} />
        <div className="p-6 text-center">
          <Flame className="w-8 h-8 mx-auto mb-2 text-amber-400/30" />
          <p className="text-xs text-muted-foreground/70 mb-1">Belum ada streak aktif</p>
          <p className="text-[10px] text-muted-foreground/50">Menangkan pertandingan berturut-turut untuk memulai streak!</p>
        </div>
      </Card>
    );
  }

  const topStreak = mergedStreaks[0];
  const runnerUps = mergedStreaks.slice(1);
  const topDt = getDivisionTheme(topStreak.division);

  return (
    <Card className={`${ct.casinoCard} overflow-hidden`}>
      <div className={ct.casinoBar} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${ct.borderSubtle} shrink-0`}>
        <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
          <FlameIcon streak={topStreak.streak} className="w-3 h-3" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">🔥 Streak Terpanjang</h3>
        {topStreak.streak >= 5 && (
          <Badge className="bg-orange-500/15 text-orange-400 text-[9px] border-orange-500/20 px-1.5 py-0 h-4 ml-auto shrink-0">
            <Crown className="w-2.5 h-2.5 mr-0.5" />
            ON FIRE
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* ─── Top streak player — hero card ─── */}
        <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${topDt.bgSubtle} border ${topDt.borderSubtle} relative overflow-hidden`}>
          {/* Animated flame glow background */}
          {topStreak.streak >= 3 && (
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(circle at 70% 50%, ${getStreakGlowColor(topStreak.streak)} 0%, transparent 70%)`,
              }}
            />
          )}

          {/* Larger avatar for top player */}
          <div className="relative z-10">
            <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 ${
              topStreak.streak >= 5 ? 'border-orange-400/60 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : 'border-idm-gold-warm/40'
            }`}>
              <AvatarMedia src={getAvatarUrl(topStreak.gamertag, topStreak.division, topStreak.avatar)} alt={topStreak.gamertag} width={56} height={56} loading="lazy" className="w-full h-full object-cover" />
            </div>
            {/* Crown badge */}
            {topStreak.streak >= 3 && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-md z-20">
                <Crown className="w-2.5 h-2.5 text-background" />
              </div>
            )}
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0 z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold truncate">{topStreak.gamertag}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {clubToString(topStreak.club) && (
                <span className="text-[10px] text-muted-foreground/60 truncate">{clubToString(topStreak.club)}</span>
              )}
              <Badge className={`${topDt.badgeBg} text-[7px] border px-1 py-0 h-3.5`}>
                {topStreak.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
              </Badge>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[9px] text-muted-foreground/50">Max: {topStreak.maxStreak}</span>
            </div>
          </div>

          {/* Streak number — animated flame */}
          <div className="flex flex-col items-center shrink-0 z-10">
            <FlameIcon streak={topStreak.streak} className="w-6 h-6 mb-0.5" />
            <span className={`text-xl font-black tabular-nums ${getStreakColor(topStreak.streak)}`}>
              {topStreak.streak}
            </span>
            <span className="text-[8px] text-muted-foreground/50 uppercase">streak</span>
          </div>
        </div>

        {/* ─── Runner-ups: 2nd-5th ─── */}
        {runnerUps.length > 0 && (
          <div className="space-y-1.5">
            {runnerUps.map((player, i) => {
              const playerDt = getDivisionTheme(player.division);
              const fireEmoji = player.streak > 5 ? '🔥🔥' : player.streak >= 3 ? '🔥' : '';

              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 p-3 rounded-lg ${i % 2 === 0 ? playerDt.bgSubtle : ''} transition-colors animate-fade-enter-sm`}
                  style={{ animationDelay: `${(i + 1) * 60}ms` }}
                >
                  {/* Rank number */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i === 0
                      ? 'bg-muted/15 text-muted-foreground'
                      : i === 1
                        ? 'bg-amber-600/20 text-amber-300'
                        : 'bg-muted/10 text-muted-foreground'
                  }`}>
                    {i + 2}
                  </div>

                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-border/30 shrink-0">
                    <AvatarMedia src={getAvatarUrl(player.gamertag, player.division, player.avatar)} alt={player.gamertag} width={28} height={28} loading="lazy" className="w-full h-full object-cover" />
                  </div>

                  {/* Name + club */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-semibold truncate">{player.gamertag}</span>
                      {clubToString(player.club) && (
                        <span className="text-[9px] text-muted-foreground/50 truncate">{clubToString(player.club)}</span>
                      )}
                    </div>
                  </div>

                  {/* Division badge */}
                  <Badge className={`${playerDt.badgeBg} text-[7px] border px-1 py-0 h-3.5 shrink-0`}>
                    {player.division === 'male' ? '🕺' : '💃'}
                  </Badge>

                  {/* Streak badge with fire */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-[10px]">{fireEmoji}</span>
                    <FlameIcon streak={player.streak} className="w-3 h-3" />
                    <span className={`text-[11px] font-bold tabular-nums ${getStreakColor(player.streak)}`}>{player.streak}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
