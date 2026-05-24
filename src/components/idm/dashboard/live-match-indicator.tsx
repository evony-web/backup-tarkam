'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Trophy, ChevronRight, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { parseWitaDate, formatWIBDateShort } from '@/lib/utils';
import { AnimatedEmptyState } from '../ui/animated-empty-state';

/* ========== Types ========== */
interface NextMatchData {
  id: string;
  player1: string;
  player2: string;
  scheduledAt: string | null;
  tournamentName: string;
}

interface RecentResult {
  id: string;
  player1: string;
  player2: string;
  score: string;
  winnerId: string | null;
  completedAt: string;
}

interface MatchNextData {
  liveCount: number;
  nextMatch: NextMatchData | null;
  recentResults: RecentResult[];
}

/* ========== Countdown Timer ========== */
function CountdownTimer({ target }: { target: Date }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = target.getTime() - now;
  if (diff <= 0) {
    return <span className="text-red-400 text-xs font-bold animate-pulse">Sedang berlangsung!</span>;
  }

  // Only show countdown if within 24 hours
  if (diff > 86400000) {
    const days = Math.floor(diff / 86400000);
    return (
      <span className="text-muted-foreground text-xs">
        Dalam {days} hari
      </span>
    );
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-1">
      <div className="countdown-digit min-w-[24px] px-1 py-0.5 rounded bg-idm-gold-warm/10 border border-idm-gold-warm/15 text-center">
        <span className="text-xs font-black text-idm-gold-warm tabular-nums">{String(hours).padStart(2, '0')}</span>
      </div>
      <span className="text-idm-gold-warm/30 text-[10px]">:</span>
      <div className="countdown-digit min-w-[24px] px-1 py-0.5 rounded bg-idm-gold-warm/10 border border-idm-gold-warm/15 text-center">
        <span className="text-xs font-black text-idm-gold-warm tabular-nums">{String(minutes).padStart(2, '0')}</span>
      </div>
      <span className="text-idm-gold-warm/30 text-[10px]">:</span>
      <div className="countdown-digit min-w-[24px] px-1 py-0.5 rounded bg-idm-gold-warm/10 border border-idm-gold-warm/15 text-center">
        <span className="text-xs font-black text-idm-gold-warm tabular-nums">{String(seconds).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

/* ========== Result Ticker Card ========== */
function ResultCard({ result, index }: { result: RecentResult; index: number }) {
  const [p1Score, p2Score] = result.score.split('-').map(Number);
  const isP1Winner = p1Score > p2Score;
  const isP2Winner = p2Score > p1Score;

  return (
    <div
      className="live-indicator-result-card shrink-0 w-[180px] rounded-lg bg-muted/30 border border-border/30 p-3 sm:p-4 hover:border-idm-gold-warm/20 transition-all"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className={`text-[11px] font-semibold truncate ${isP1Winner ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
          {result.player1}
        </span>
        <span className={`text-[11px] font-black tabular-nums ${isP1Winner ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
          {p1Score}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1.5 mt-0.5">
        <span className={`text-[11px] font-semibold truncate ${isP2Winner ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
          {result.player2}
        </span>
        <span className={`text-[11px] font-black tabular-nums ${isP2Winner ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
          {p2Score}
        </span>
      </div>
    </div>
  );
}

/* ========== Loading Skeleton ========== */
function LiveMatchIndicatorSkeleton() {
  return (
    <div className="rounded-2xl bg-muted/30 border border-border/30 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-transparent via-idm-gold-warm/20 to-transparent" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-16 h-5 rounded-full bg-white/[0.06]" />
          <div className="flex-1" />
          <Skeleton className="w-20 h-5 rounded-full bg-white/[0.06]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-full rounded-lg bg-white/[0.04]" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-[180px] h-14 rounded-lg bg-white/[0.04] shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========== Main Component ========== */
export function LiveMatchIndicator() {
  const dt = useDivisionTheme();
  const { division } = useAppStore();

  const { data, isLoading } = useQuery<MatchNextData>({
    queryKey: ['matches-next', division],
    queryFn: async () => {
      const res = await fetch(`/api/matches/next?division=${division}`);
      if (!res.ok) return { liveCount: 0, nextMatch: null, recentResults: [] };
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  if (isLoading) return <LiveMatchIndicatorSkeleton />;

  const { liveCount, nextMatch, recentResults } = data ?? { liveCount: 0, nextMatch: null, recentResults: [] };
  const hasLive = liveCount > 0;
  const hasUpcoming = !!nextMatch?.scheduledAt;

  return (
    <div className="live-match-indicator-card rounded-2xl bg-muted/30 border border-border/30 overflow-hidden">
      {/* Top accent bar */}
      <div className={`h-1 ${hasLive ? 'bg-gradient-to-r from-red-500/60 via-red-400/40 to-red-500/60 animate-pulse' : 'bg-gradient-to-r from-transparent via-idm-gold-warm/20 to-transparent'}`} />

      <div className="p-3 sm:p-4 space-y-3">
        {/* Row 1: LIVE badge + Next match info */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* LIVE badge with animated red ping */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${hasLive ? 'bg-red-500/15 border border-red-500/30' : 'bg-muted/30 border border-border/30'}`}>
            <span className="relative flex h-2 w-2">
              {hasLive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${hasLive ? 'bg-red-500' : 'bg-muted-foreground/30'}`} />
            </span>
            <span className={`text-[10px] font-black tracking-wider ${hasLive ? 'text-red-500' : 'text-muted-foreground/50'}`}>
              {hasLive ? 'LIVE' : 'OFFLINE'}
            </span>
            {hasLive && (
              <span className="text-[10px] text-red-400/80 font-semibold ml-0.5">{liveCount}</span>
            )}
          </div>

          {/* Next match countdown */}
          {hasUpcoming ? (
            <div className="flex items-center gap-2 ml-auto">
              <Clock className={`w-3 h-3 ${dt.neonText}`} />
              <CountdownTimer target={parseWitaDate(nextMatch!.scheduledAt!) ?? new Date()} />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 ml-auto">
              <Radio className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground/50">Belum ada jadwal</span>
            </div>
          )}
        </div>

        {/* Row 2: Next match details */}
        {nextMatch && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle}`}>
            <Trophy className={`w-3.5 h-3.5 ${dt.neonText} shrink-0`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-white/90 truncate">
                {nextMatch.player1} vs {nextMatch.player2}
              </p>
              <p className="text-[9px] text-muted-foreground truncate">{nextMatch.tournamentName}</p>
            </div>
            {nextMatch.scheduledAt && (
              <span className="text-[9px] text-muted-foreground/60 shrink-0">
                {parseWitaDate(nextMatch.scheduledAt) ? formatWIBDateShort(parseWitaDate(nextMatch.scheduledAt)!) : ''}
              </span>
            )}
            <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
          </div>
        )}

        {/* Row 3: Recent results horizontal ticker */}
        {recentResults.length > 0 ? (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Activity className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">Hasil Terakhir</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {recentResults.map((result, idx) => (
                <ResultCard key={result.id} result={result} index={idx} />
              ))}
            </div>
          </div>
        ) : (
          !nextMatch && !hasLive && (
            <AnimatedEmptyState
              icon={Activity}
              message="Belum ada pertandingan"
              hint="Match day akan muncul di sini saat dimulai"
            />
          )
        )}
      </div>
    </div>
  );
}
