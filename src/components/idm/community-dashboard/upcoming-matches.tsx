'use client';

import { useMemo } from 'react';
import { Clock, Trophy, Calendar, Timer, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommunityTheme } from '@/hooks/use-community-theme';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { parseWitaDate } from '@/lib/utils';
import type { StatsData, UpcomingMatch, ActiveTournament } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   UPCOMING MATCHES — Schedule with countdown timers
   ═══════════════════════════════════════════════════════ */
type DivisionFilter = 'all' | 'male' | 'female';

interface UpcomingMatchesProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
}

/* ── Enriched match with division info ── */
interface EnrichedMatch {
  id: string;
  club1Name: string;
  club2Name: string;
  week: number;
  division: 'male' | 'female';
  scheduledAt: string | null;
}

/* ── Countdown calculation ── */
function getCountdown(scheduledAt: string): string | null {
  const now = new Date();
  const target = parseWitaDate(scheduledAt);
  if (!target) return null;
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return null; // already started/passed

  const diffHours = Math.floor(diffMs / 3600000);
  const diffMinutes = Math.floor((diffMs % 3600000) / 60000);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return `${diffDays} hari lagi`;
  }

  return `Dimulai dalam ${diffHours}j ${diffMinutes}m`;
}

/* ── Single match card ── */
function MatchCard({ match, index }: { match: EnrichedMatch; index: number }) {
  const dt = getDivisionTheme(match.division);
  const countdown = match.scheduledAt ? getCountdown(match.scheduledAt) : null;

  return (
    <div
      className="animate-fade-enter-sm"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Card className={`${dt.casinoCard} border ${dt.borderSubtle} overflow-hidden group hover:shadow-md transition-all duration-300`}>
        <CardContent className="p-4 sm:p-6">
          {/* Division badge */}
          <div className="flex items-center justify-between mb-2.5">
            <Badge className={`${dt.badgeBg} text-[8px] border`}>
              {match.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </Badge>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <Calendar className="w-2.5 h-2.5" />
              <span>Week {match.week}</span>
            </div>
          </div>

          {/* VS display */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 text-center">
              <p className="text-xs font-bold truncate">{match.club1Name}</p>
            </div>
            <div className={`shrink-0 w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center`}>
              <Trophy className={`w-3.5 h-3.5 ${dt.text}`} />
            </div>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-xs font-bold truncate">{match.club2Name}</p>
            </div>
          </div>

          {/* Countdown */}
          {countdown && (
            <div className="mt-2.5 pt-2 border-t border-border/10 flex items-center justify-center gap-1.5">
              <Timer className="w-3 h-3 text-idm-gold-warm" />
              <span className="text-[10px] font-semibold text-idm-gold-warm">{countdown}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function UpcomingMatches({ maleData, femaleData, selectedDivision = 'all' }: UpcomingMatchesProps) {
  const dt = useCommunityTheme();

  const enrichedMatches = useMemo(() => {
    const items: EnrichedMatch[] = [];

    // Helper to get scheduledAt from activeTournament
    const getScheduledAt = (data: StatsData | undefined): string | null => {
      const t = data?.activeTournament;
      if (t?.scheduledAt) return t.scheduledAt;
      return null;
    };

    // Male division matches
    if ((selectedDivision === 'all' || selectedDivision === 'male') && maleData?.upcomingMatches) {
      const maleScheduled = getScheduledAt(maleData);
      for (const m of maleData.upcomingMatches) {
        items.push({
          id: `m-${m.id}`,
          club1Name: m.club1.name,
          club2Name: m.club2.name,
          week: m.week,
          division: 'male',
          scheduledAt: maleScheduled,
        });
      }
    }

    // Female division matches
    if ((selectedDivision === 'all' || selectedDivision === 'female') && femaleData?.upcomingMatches) {
      const femaleScheduled = getScheduledAt(femaleData);
      for (const m of femaleData.upcomingMatches) {
        items.push({
          id: `f-${m.id}`,
          club1Name: m.club1.name,
          club2Name: m.club2.name,
          week: m.week,
          division: 'female',
          scheduledAt: femaleScheduled,
        });
      }
    }

    // Sort: matches with countdown first, then by week
    items.sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) {
        return (parseWitaDate(a.scheduledAt)?.getTime() ?? 0) - (parseWitaDate(b.scheduledAt)?.getTime() ?? 0);
      }
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return a.week - b.week;
    });

    // Limit to 6
    return items.slice(0, 6);
  }, [maleData, femaleData, selectedDivision]);

  // Empty state
  if (enrichedMatches.length === 0) {
    return (
      <Card className={`${dt.casinoCard} overflow-hidden`}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center`}>
              <Clock className={`w-3.5 h-3.5 ${dt.text}`} />
            </div>
            <span className={`text-xs font-bold ${dt.neonText}`}>Jadwal Pertandingan</span>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-[10px] text-muted-foreground/50 font-medium">Belum ada jadwal pertandingan</p>
            <p className="text-[9px] text-muted-foreground/30 mt-0.5">Jadwal akan muncul saat turnamen dijadwalkan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${dt.casinoCard} overflow-hidden`}>
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 rounded-lg ${dt.iconBg} flex items-center justify-center`}>
            <Clock className={`w-3.5 h-3.5 ${dt.text}`} />
          </div>
          <span className={`text-xs font-bold ${dt.neonText}`}>Jadwal Pertandingan</span>
          <Badge className={`${dt.badgeBg} text-[8px] border ml-auto`}>
            {enrichedMatches.length} Match
          </Badge>
        </div>

        {/* Match grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {enrichedMatches.map((match, i) => (
            <MatchCard key={match.id} match={match} index={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
