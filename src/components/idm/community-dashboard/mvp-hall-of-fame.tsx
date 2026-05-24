'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Star, Trophy, Crown, Award, Music, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { getCommunityTheme } from '@/hooks/use-community-theme';
import { getAvatarUrl } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import type { StatsData, MvpHallOfFameEntry } from '@/types/stats';

/* ═══════════════════════════════════════════
   MVP Hall of Fame — Horizontal Scroll Timeline
   Shows all MVPs per week across the season.
   Empty state mirrors MVP Spotlight avatar panel style.
   Follows unified card pattern when "all" selected.

   Layout: CSS Grid 10-cols → items fill container evenly on desktop,
   horizontal scroll on mobile with arrow indicators + gradient fade.
   ═══════════════════════════════════════════ */

type DivisionFilter = 'all' | 'male' | 'female';

interface MvpHallOfFameProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
}

/** Total weeks in a season — defines the timeline length */
const TOTAL_WEEKS = 10;

/* ─── Single Week Slot — Empty or Filled ─── */
function WeekSlot({
  weekNumber,
  entry,
  division,
}: {
  weekNumber: number;
  entry?: MvpHallOfFameEntry;
  division: 'male' | 'female';
}) {
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const divisionGradient = division === 'male'
    ? 'from-idm-male/20 to-idm-male/5'
    : 'from-idm-female/20 to-idm-female/5';

  /* ─── Filled state: MVP winner ─── */
  if (entry) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        {/* Avatar panel — mirrors MVP Spotlight avatar style */}
        <div
          className={`relative w-full max-w-[80px] rounded-2xl overflow-hidden bg-gradient-to-br ${divisionGradient} border shrink-0`}
          style={{ borderColor: accentColor + '30', aspectRatio: '3/4' }}
        >
          {/* Full-cover avatar — static poster for small cards, no autoplay */}
          <AvatarMedia
            src={getAvatarUrl(entry.gamertag, division, entry.avatar)}
            alt={entry.gamertag}
            width={80}
            height={107}
            className="w-full h-full object-cover"
            loading="lazy"
            loop={false}
          />

          {/* Gradient overlay — same as MVP Spotlight */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

          {/* Crown badge — top right, same as MVP Spotlight */}
          <div className="absolute top-1 right-1 z-10">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-idm-gold-warm flex items-center justify-center shadow-[0_0_8px_rgba(239,249,35,0.4)] mvp-platinum-pulse">
              <Crown className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-background" />
            </div>
          </div>

          {/* MVP badge — bottom, same style as MVP Spotlight */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-gradient-to-r from-idm-gold-warm to-amber-500 text-black text-[6px] sm:text-[7px] font-black border-0 px-1.5 py-0 shadow-[0_0_6px_rgba(249,203,37,0.3)] whitespace-nowrap">
              <Star className="w-1.5 h-1.5 sm:w-2 sm:h-2 mr-0.5" />
              MVP
            </Badge>
          </div>
        </div>

        {/* Name + info */}
        <div className="w-full text-center px-0.5">
          <p className="text-[9px] sm:text-[10px] font-bold truncate leading-tight">{entry.gamertag}</p>
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            <Star className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
            <span className="text-[8px] sm:text-[9px] font-bold text-yellow-400 tabular-nums">{entry.totalMvp}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Empty state: Ghost placeholder matching MVP avatar style ─── */
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Ghost avatar panel — mirrors filled avatar panel dimensions */}
      <div
        className={`relative w-full max-w-[80px] rounded-2xl overflow-hidden bg-gradient-to-br ${divisionGradient} border shrink-0 flex items-center justify-center`}
        style={{ borderColor: accentColor + '15', aspectRatio: '3/4' }}
      >
        {/* Ghost Award icon — matches MVP Spotlight empty state */}
        <Award className="w-6 h-6 sm:w-8 sm:h-8 opacity-15" style={{ color: accentColor }} />

        {/* Week label overlay — ghosted */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
          <div className="rounded-full px-1.5 py-0.5 bg-muted/30 border border-border/10">
            <span className="text-[6px] sm:text-[7px] font-bold text-muted-foreground/40 tabular-nums">W{weekNumber}</span>
          </div>
        </div>
      </div>

      {/* Ghost name */}
      <div className="w-full text-center px-0.5">
        <div className="h-2.5 sm:h-3 w-10 sm:w-12 mx-auto rounded bg-muted/20" />
        <div className="h-2 w-6 mx-auto rounded bg-muted/15 mt-1" />
      </div>
    </div>
  );
}

/* ─── Scrollable Timeline with Gradient Fade Hints ─── */
function ScrollableTimeline({
  division,
  entries,
}: {
  division: 'male' | 'female';
  entries: MvpHallOfFameEntry[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Build week map — entry per weekNumber
  const weekMap = new Map<number, MvpHallOfFameEntry>();
  entries.forEach(e => weekMap.set(e.weekNumber, e));

  /* Check scroll position to show/hide fade edges */
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  return (
    <div className="relative">
      {/* Left gradient fade — subtle hint there's more content */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-background/80 to-transparent z-10 pointer-events-none" />
      )}

      {/* Right gradient fade — subtle hint there's more content */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-l from-background/80 to-transparent z-10 pointer-events-none" />
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-none -mx-1 px-1"
      >
        {/* Grid: 10 equal columns that fill container width on desktop,
            min-width forces scroll on mobile when content overflows */}
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 lg:gap-2 min-w-[600px] sm:min-w-[680px] pb-1">
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(week => (
            <WeekSlot
              key={week}
              weekNumber={week}
              entry={weekMap.get(week)}
              division={division}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Per-division timeline row (bare mode for unified card) ─── */
function DivisionTimeline({
  division,
  entries,
  bare = false,
}: {
  division: 'male' | 'female';
  entries: MvpHallOfFameEntry[];
  bare?: boolean;
}) {
  const dt = getDivisionTheme(division);
  const accentColor = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';

  const timeline = <ScrollableTimeline division={division} entries={entries} />;

  // Bare mode: division label + timeline, no card wrapper
  if (bare) {
    return (
      <div className={`p-3 sm:p-4 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle}`}>
        {/* Division label */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <DivisionIcon className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
          {entries.length > 0 && (
            <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm border-idm-gold-warm/20 text-[8px] ml-auto">
              {entries.length}/{TOTAL_WEEKS}
            </Badge>
          )}
        </div>
        {timeline}
      </div>
    );
  }

  // Full mode: just the timeline
  return timeline;
}

/* ═══════════════════════════════════════════
   Main Component — MVP Hall of Fame
   ═══════════════════════════════════════════ */
export const MvpHallOfFame = React.memo(function MvpHallOfFame({ maleData, femaleData, selectedDivision = 'all' }: MvpHallOfFameProps) {
  const ct = getCommunityTheme();
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  const maleEntries = maleData?.mvpHallOfFame || [];
  const femaleEntries = femaleData?.mvpHallOfFame || [];

  // Unified card for "all" mode
  if (selectedDivision === 'all') {
    return (
      <Card className={`${ct.casinoCard} dashboard-card-alive overflow-hidden`}>
        <div className={ct.casinoBar} />
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${ct.borderSubtle}`}>
          <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
            <Trophy className={`w-3 h-3 ${ct.neonText}`} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-idm-gold-warm">MVP Hall of Fame</span>
          <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 ml-auto text-[9px] font-bold">
            <Crown className="w-2.5 h-2.5 mr-0.5" />
            {maleEntries.length + femaleEntries.length}/{TOTAL_WEEKS * 2}
          </Badge>
        </div>
        {/* Content — male + female stacked */}
        <div className="p-4 sm:p-6">
          <div className="space-y-3">
            {showMale && (
              <DivisionTimeline division="male" entries={maleEntries} bare />
            )}
            {showFemale && (
              <DivisionTimeline division="female" entries={femaleEntries} bare />
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Single division mode
  const division = selectedDivision === 'female' ? 'female' : 'male';
  const dt = getDivisionTheme(division);
  const entries = division === 'female' ? femaleEntries : maleEntries;

  return (
    <Card className={`${dt.casinoCard} dashboard-card-alive overflow-hidden`}>
      <div className={dt.casinoBar} />
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-5 py-2.5 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Trophy className={`w-3 h-3 ${dt.neonText}`} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider">MVP Hall of Fame</span>
        <Badge className={`${dt.casinoBadge} ml-auto text-[9px]`}>
          {entries.length}/{TOTAL_WEEKS}
        </Badge>
      </div>
      {/* Content */}
      <div className="p-4 sm:p-6">
        <DivisionTimeline division={division} entries={entries} />
      </div>
    </Card>
  );
});
