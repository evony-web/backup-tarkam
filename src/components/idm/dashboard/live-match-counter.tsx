'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Trophy, CheckCircle2, Clock, Radio } from 'lucide-react';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';

interface LiveCountData {
  activeTournaments: number;
  completedMatches: number;
  upcomingMatches: number;
  liveNow: boolean;
}

/* Animated number — count-up from 0 on mount/data change */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (value === display) return;
    // Simple stepped animation
    const diff = value - display;
    const step = Math.max(1, Math.abs(diff) > 10 ? Math.ceil(Math.abs(diff) / 10) : 1);
    const dir = diff > 0 ? 1 : -1;
    let current = display;

    const interval = setInterval(() => {
      current += dir * step;
      if ((dir > 0 && current >= value) || (dir < 0 && current <= value)) {
        current = value;
        clearInterval(interval);
      }
      setDisplay(current);
    }, 30);

    return () => clearInterval(interval);
  }, [value, display]);

  return <span className="tabular-nums">{display}</span>;
}

export function LiveMatchCounter() {
  const dt = useDivisionTheme();
  const { division } = useAppStore();

  const { data, isLoading } = useQuery<LiveCountData>({
    queryKey: ['matches-live-count', division],
    queryFn: async () => {
      const res = await fetch(`/api/matches/live-count?division=${division}`);
      if (!res.ok) return { activeTournaments: 0, completedMatches: 0, upcomingMatches: 0, liveNow: false };
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const stats = [
    {
      icon: Trophy,
      label: 'Turnamen Aktif',
      value: data?.activeTournaments ?? 0,
      color: 'text-idm-gold-warm',
      bg: 'bg-idm-gold-warm/10',
    },
    {
      icon: CheckCircle2,
      label: 'Match Selesai',
      value: data?.completedMatches ?? 0,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      icon: Clock,
      label: 'Akan Datang',
      value: data?.upcomingMatches ?? 0,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className={`rounded-2xl ${dt.casinoCard} border ${dt.border} overflow-hidden live-match-counter-card`}>
      <div className={dt.casinoBar} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Activity className={`w-3 h-3 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">Status Pertandingan</h3>

        {/* LIVE indicator */}
        {data?.liveNow && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] font-black text-red-500 tracking-wider">LIVE</span>
          </div>
        )}

        {!data?.liveNow && !isLoading && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/30 border border-border/30">
            <Radio className="w-2.5 h-2.5 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold text-muted-foreground/50 tracking-wider">OFFLINE</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-stretch divide-x divide-white/[0.04]">
        {isLoading ? (
          // Skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 px-3 py-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-muted/15 animate-pulse shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 w-6 bg-muted/15 rounded animate-pulse" />
                <div className="h-2 w-14 bg-muted/10 rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex-1 p-3 sm:p-4 flex items-center gap-2.5 transition-colors hover:bg-white/[0.02] live-counter-stat`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-black ${stat.color}`}>
                  <AnimatedNumber value={stat.value} />
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider truncate">{stat.label}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
