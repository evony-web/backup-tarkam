'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Calendar, Zap, Radio, Timer } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';

interface CountdownProps {
  division: 'male' | 'female';
}

/* Time remaining display */
function TimeRemaining({ target, label }: { target: Date; label: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = target.getTime() - now;
  if (diff <= 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="live-indicator-enhanced w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm font-bold text-red-400">SEDANG BERLANGSUNG</span>
      </div>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-1.5">
      {days > 0 && (
        <TimeUnit value={days} unit="Hari" />
      )}
      <TimeUnit value={hours} unit="Jam" />
      <span className="text-idm-gold-warm/30 text-xs">:</span>
      <TimeUnit value={minutes} unit="Menit" />
      <span className="text-idm-gold-warm/30 text-xs">:</span>
      <TimeUnit value={seconds} unit="Detik" />
    </div>
  );
}

function TimeUnit({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="countdown-digit min-w-[28px] px-1.5 py-1 rounded-md bg-idm-gold-warm/10 border border-idm-gold-warm/15 text-center">
        <span className="text-sm sm:text-base font-black text-idm-gold-warm tabular-nums">{String(value).padStart(2, '0')}</span>
      </div>
      <span className="text-[8px] text-muted-foreground/60 mt-0.5 uppercase">{unit}</span>
    </div>
  );
}

export function MatchDayCountdown({ division }: CountdownProps) {
  const dt = useDivisionTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['next-match-day', division],
    queryFn: async () => {
      const res = await fetch(`/api/league-matches?division=${division}&limit=5`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
  });

  // Calculate next match day (assume matches happen on Saturdays)
  const getNextMatchDay = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Next Saturday (6) at 19:00 WIB
    const daysUntilSat = dayOfWeek >= 6 ? 7 - dayOfWeek + 6 : 6 - dayOfWeek;
    const nextSat = new Date(now);
    nextSat.setDate(now.getDate() + daysUntilSat);
    nextSat.setHours(19, 0, 0, 0);
    return nextSat;
  };

  const nextMatchDay = getNextMatchDay();
  const upcomingCount = data?.matches?.filter((m: any) => m.status === 'upcoming').length || 0;
  const hasActiveTournament = data?.matches?.some((m: any) => m.status === 'in_progress');

  return (
    <Card className={`${dt.casinoCard} overflow-hidden countdown-card`}>
      <div className={dt.casinoBar} />
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Timer className={`w-3 h-3 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider">Match Day</h3>
        {hasActiveTournament ? (
          <Badge className="ml-auto bg-red-500/15 text-red-400 text-[9px] border border-red-500/30 flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            LIVE
          </Badge>
        ) : (
          <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>
            <Calendar className="w-2.5 h-2.5 mr-0.5" />
            NEXT
          </Badge>
        )}
      </div>

      {/* Countdown Display */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center">
          <TimeRemaining target={nextMatchDay} label="Match Day" />
        </div>

        {/* Match Day Info */}
        <div className={`flex items-center justify-between p-3 sm:p-4 rounded-lg ${dt.bgSubtle} ${dt.borderSubtle}`}>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Sabtu, 19:00 WIB</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-idm-gold-warm" />
            <span className="text-[10px] text-idm-gold-warm font-semibold">{upcomingCount > 0 ? `${upcomingCount} match menunggu` : 'Jadwal segera hadir'}</span>
          </div>
        </div>

        {/* Quick reminder text */}
        <p className="text-center text-[10px] text-muted-foreground/50">
          Setiap Sabtu malam — Club terbaik bertarung di arena!
        </p>
      </div>
    </Card>
  );
}
