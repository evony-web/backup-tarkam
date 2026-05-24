'use client';

import React, { useState } from 'react';
import { Crown, Trophy, Medal, Music, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerCard } from '../player-card';
import { WeekNavigator } from '../week-navigator';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { getCommunityTheme } from '@/hooks/use-community-theme';
import type { StatsData, WeeklyChampion, TopPlayer } from '@/types/stats';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
type DivisionFilter = 'all' | 'male' | 'female';

type PlayerClickHandler = (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;

interface WeeklyChampionsProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
  onPlayerClick?: PlayerClickHandler;
}

/* ═══════════════════════════════════════════
   Per-Division Weekly Champions Content
   When bare=false (default): renders own <Card> wrapper (single-division mode)
   When bare=true: renders inner content only (unified "all" mode)
   ═══════════════════════════════════════════ */
function DivisionWeeklyChampions({
  division,
  champions,
  totalWeeks,
  seasonProgressCompletedWeeks,
  bare = false,
  onPlayerClick,
}: {
  division: 'male' | 'female';
  champions: WeeklyChampion[];
  totalWeeks: number;
  seasonProgressCompletedWeeks: number;
  bare?: boolean;
  onPlayerClick?: PlayerClickHandler;
}) {
  const dt = getDivisionTheme(division);
  const accent = division === 'male' ? '#2E9FFF' : '#FF2D78';
  const accentLight = division === 'male' ? '#57B5FF' : '#FF5C9A';

  // Week navigator state — default to latest completed week
  const completedWeeks = champions.map(c => c.weekNumber);
  const defaultWeek = completedWeeks.length > 0 ? completedWeeks[completedWeeks.length - 1] : 1;
  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeek);

  // Find the selected week's champion data
  const selectedChampion = champions.find(c => c.weekNumber === selectedWeek) || champions[champions.length - 1] || null;
  const winnerTeam = selectedChampion?.winnerTeam;
  const championPlayers = winnerTeam?.players || [];

  // Division identity for unified mode
  const DivisionIcon = division === 'male' ? Music : Shield;
  const genderSymbol = division === 'male' ? '♂' : '♀';

  /* ─── Inner content (shared between bare and wrapped modes) ─── */
  const innerContent = (
    <>
      {champions.length === 0 ? (
        <div className="space-y-4">
          {/* Ghost team banner */}
          <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border} opacity-55`}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500/25 to-amber-600/25 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-yellow-500/40" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-4 w-24 rounded bg-muted/35 mb-1.5" />
              <div className="h-3 w-36 rounded bg-muted/25" />
            </div>
            <div className="h-5 w-12 rounded-full bg-muted/25 shrink-0" />
          </div>

          {/* Ghost player cards — 3-column grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="opacity-45">
                <div className={`rounded-2xl overflow-hidden border ${dt.borderSubtle}`}>
                  {/* Ghost avatar area */}
                  <div
                    className="w-full flex items-center justify-center"
                    style={{ aspectRatio: '3/4', background: `linear-gradient(135deg, ${accent}18, ${accent}08)` }}
                  >
                    <Trophy className="w-6 h-6 opacity-30" style={{ color: accent }} />
                  </div>
                  {/* Ghost name */}
                  <div className="p-3 space-y-1.5">
                    <div className="h-3 w-12 mx-auto rounded bg-muted/35" />
                    <div className="h-2 w-8 mx-auto rounded bg-muted/25" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ghost week navigator dots */}
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-muted/45' : 'bg-muted/20'}`} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Team banner */}
          <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border}`}>
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shrink-0 champion-gold-pulse`}>
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-yellow-400 truncate">{winnerTeam?.name || 'TBD'}</p>
              <p className="text-[10px] text-muted-foreground">
                {selectedChampion ? `Week ${selectedChampion.weekNumber} Champion • ${selectedChampion.tournamentName}` : 'Belum ada pemenang'}
              </p>
            </div>
            <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px] shrink-0">🏆 JUARA</Badge>
          </div>

          {/* Player Cards — 3-column grid with separated cards, all equal champions */}
          {championPlayers.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {championPlayers.slice(0, 3).map((p) => (
                <div key={p.id} className="relative">
                  {/* MVP indicator for the MVP player */}
                  {selectedChampion?.mvp?.id === p.id && (
                    <div className="absolute top-1.5 left-1.5 z-20">
                      <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Medal className="w-3 h-3 text-yellow-400" />
                      </div>
                    </div>
                  )}
                  <PlayerCard
                    gamertag={p.gamertag}
                    avatar={p.avatar}
                    points={p.points}
                    totalWins={p.totalWins}
                    totalMvp={p.totalMvp}
                    streak={p.streak}
                    rank={1}
                    isMvp={selectedChampion?.mvp?.id === p.id}
                    club={winnerTeam?.name}
                    onClick={onPlayerClick ? () => onPlayerClick({
                      id: p.id,
                      name: p.gamertag,
                      gamertag: p.gamertag,
                      avatar: p.avatar,
                      tier: p.tier,
                      points: p.points,
                      totalWins: p.totalWins,
                      totalMvp: p.totalMvp,
                      streak: p.streak,
                      maxStreak: p.streak,
                      matches: 0,
                      club: winnerTeam?.name,
                      city: p.city,
                      division,
                    }, division) : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-6 rounded-2xl ${dt.bgSubtle} ${dt.border} text-center`}>
              <p className="text-sm text-muted-foreground">Belum ada data week ini</p>
            </div>
          )}

          {/* Extra players if team has more than 3 */}
          {championPlayers.length > 3 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-muted-foreground/50">Also:</span>
              {championPlayers.slice(3).map((p) => (
                <Badge key={p.id} variant="outline" className="text-[9px] h-5 px-1.5">
                  {p.gamertag}
                </Badge>
              ))}
            </div>
          )}

          {/* Week Navigator */}
          <WeekNavigator
            totalWeeks={totalWeeks}
            completedWeeks={completedWeeks}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            accent={accent}
            accentLight={accentLight}
            size="xs"
          />
        </div>
      )}
    </>
  );

  /* ─── Bare mode: content only (used inside unified card) ─── */
  if (bare) {
    return (
      <div className={`p-4 lg:p-5 rounded-2xl ${dt.bgSubtle} ${dt.borderSubtle} dashboard-card-glow`}>
        {/* Division label — small, like ReigningChampionPlaque */}
        <div className="flex items-center gap-1.5 mb-3">
          <DivisionIcon className="w-3 h-3 shrink-0" style={{ color: accent }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            {division === 'male' ? 'COWO' : 'CEWE'} {genderSymbol}
          </span>
          {champions.length > 0 && (
            <Badge className={`ml-auto ${dt.casinoBadge} text-[9px]`}>
              {champions.length} WEEK
            </Badge>
          )}
        </div>
        {innerContent}
      </div>
    );
  }

  /* ─── Wrapped mode: full card with header (single-division mode) ─── */
  return (
    <Card className={`${dt.casinoCard} dashboard-card-alive dashboard-card-glow overflow-hidden relative`}>
      <div className={dt.casinoBar} />
      {/* Decorative blur orb */}
      <div className={`hidden lg:block absolute top-8 right-8 w-32 h-32 rounded-full blur-3xl ${dt.bg} opacity-20 pointer-events-none`} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
        <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
          <Trophy className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
          {division === 'male' ? '🕺 Cowo' : '💃 Cewe'} Juara Tarkam
        </h3>
        {champions.length > 0 && (
          <Badge className={`hidden sm:inline-flex ${dt.casinoBadge} ml-auto text-[9px]`}>
            {champions.length} WEEK
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        {innerContent}
      </div>
    </Card>
  );
}


/* ═══════════════════════════════════════════
   Main Component — Weekly Tarkam Champions
   "all" → unified card with community gold theme
   specific division → single division card
   ═══════════════════════════════════════════ */
export function CommunityWeeklyChampions({ maleData, femaleData, selectedDivision = 'all', onPlayerClick }: WeeklyChampionsProps) {
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  const maleChampions = maleData?.weeklyChampions || [];
  const femaleChampions = femaleData?.weeklyChampions || [];
  const maleTotalWeeks = maleData?.seasonProgress?.totalWeeks || 10;
  const femaleTotalWeeks = femaleData?.seasonProgress?.totalWeeks || 10;
  const maleCompletedWeeks = maleData?.seasonProgress?.completedWeeks || 0;
  const femaleCompletedWeeks = femaleData?.seasonProgress?.completedWeeks || 0;

  // Single division selected with no champions → single empty state with ghost cards
  if (selectedDivision !== 'all') {
    const champions = selectedDivision === 'female' ? femaleChampions : maleChampions;
    if (champions.length === 0) {
      const division = selectedDivision === 'female' ? 'female' : 'male';
      const dt = getDivisionTheme(division);
      const accent = division === 'male' ? '#2E9FFF' : '#FF2D78';
      return (
        <Card className={`${dt.casinoCard} overflow-hidden`}>
          <div className={dt.casinoBar} />
          <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${dt.borderSubtle}`}>
            <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${dt.iconBg} flex items-center justify-center shrink-0`}>
              <Trophy className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${dt.neonText}`} />
            </div>
            <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
              {division === 'male' ? '🕺 Cowo' : '💃 Cewe'} Juara Tarkam
            </h3>
          </div>
          <div className="p-4 lg:p-6">
            <div className="space-y-4">
              {/* Ghost team banner */}
              <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${dt.bgSubtle} ${dt.border} opacity-55`}>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500/25 to-amber-600/25 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-yellow-500/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-24 rounded bg-muted/35 mb-1.5" />
                  <div className="h-3 w-36 rounded bg-muted/25" />
                </div>
                <div className="h-5 w-12 rounded-full bg-muted/25 shrink-0" />
              </div>
              {/* Ghost player cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="opacity-45">
                    <div className={`rounded-2xl overflow-hidden border ${dt.borderSubtle}`}>
                      <div
                        className="w-full flex items-center justify-center"
                        style={{ aspectRatio: '3/4', background: `linear-gradient(135deg, ${accent}18, ${accent}08)` }}
                      >
                        <Trophy className="w-6 h-6 opacity-30" style={{ color: accent }} />
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="h-3 w-12 mx-auto rounded bg-muted/35" />
                        <div className="h-2 w-8 mx-auto rounded bg-muted/25" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Ghost week navigator */}
              <div className="flex items-center justify-center gap-1.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-muted/45' : 'bg-muted/20'}`} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      );
    }
  }

  /* ─── Unified card when "all" (Semua) is selected ─── */
  if (selectedDivision === 'all') {
    const ct = getCommunityTheme();
    const bothEmpty = maleChampions.length === 0 && femaleChampions.length === 0;

    // Both divisions empty → one unified ghost state inside the gold card
    if (bothEmpty) {
      const maleDt = getDivisionTheme('male');
      const femaleDt = getDivisionTheme('female');
      return (
        <Card className={`${ct.casinoCard} dashboard-card-alive overflow-hidden`}>
          <div className={ct.casinoBar} />
          {/* Header */}
          <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${ct.borderSubtle}`}>
            <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
              <Trophy className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${ct.neonText}`} />
            </div>
            <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
              Juara Tarkam
            </h3>
          </div>
          {/* Ghost content — both divisions */}
          <div className="p-4 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
              {/* Male ghost */}
              <div className={`p-4 lg:p-5 rounded-2xl ${maleDt.bgSubtle} ${maleDt.borderSubtle} opacity-55`}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Music className="w-3 h-3 shrink-0" style={{ color: '#2E9FFF' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#2E9FFF' }}>Cowo ♂</span>
                </div>
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${maleDt.bgSubtle} ${maleDt.border}`}>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500/25 to-amber-600/25 flex items-center justify-center shrink-0">
                      <Crown className="w-5 h-5 text-yellow-500/40" />
                    </div>
                    <div className="flex-1"><div className="h-4 w-20 rounded bg-muted/35 mb-1.5" /><div className="h-3 w-28 rounded bg-muted/25" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className={`rounded-2xl overflow-hidden border ${maleDt.borderSubtle}`}>
                        <div className="w-full flex items-center justify-center" style={{ aspectRatio: '3/4', background: 'linear-gradient(135deg, #2E9FFF18, #2E9FFF08)' }}>
                          <Trophy className="w-5 h-5 opacity-30 text-idm-male" />
                        </div>
                        <div className="p-1.5 space-y-1"><div className="h-2.5 w-8 mx-auto rounded bg-muted/35" /><div className="h-2 w-6 mx-auto rounded bg-muted/25" /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Female ghost */}
              <div className={`p-4 lg:p-5 rounded-2xl ${femaleDt.bgSubtle} ${femaleDt.borderSubtle} opacity-55`}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Shield className="w-3 h-3 shrink-0" style={{ color: '#FF2D78' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#FF2D78' }}>Cewe ♀</span>
                </div>
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-4 sm:p-5 rounded-2xl ${femaleDt.bgSubtle} ${femaleDt.border}`}>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500/25 to-amber-600/25 flex items-center justify-center shrink-0">
                      <Crown className="w-5 h-5 text-yellow-500/40" />
                    </div>
                    <div className="flex-1"><div className="h-4 w-20 rounded bg-muted/35 mb-1.5" /><div className="h-3 w-28 rounded bg-muted/25" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className={`rounded-2xl overflow-hidden border ${femaleDt.borderSubtle}`}>
                        <div className="w-full flex items-center justify-center" style={{ aspectRatio: '3/4', background: 'linear-gradient(135deg, #FF2D7818, #FF2D7808)' }}>
                          <Trophy className="w-5 h-5 opacity-30 text-idm-female" />
                        </div>
                        <div className="p-3 space-y-1"><div className="h-2.5 w-8 mx-auto rounded bg-muted/35" /><div className="h-2 w-6 mx-auto rounded bg-muted/25" /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    // At least one division has data → unified card with sub-sections
    return (
      <Card className={`${ct.casinoCard} dashboard-card-alive overflow-hidden relative`}>
        <div className={ct.casinoBar} />

        {/* Header — "Juara Tarkam" (one header, no division label) */}
        <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${ct.borderSubtle}`}>
          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
            <Trophy className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${ct.neonText}`} />
          </div>
          <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
            Juara Tarkam
          </h3>
          {/* Combined week count badge */}
          {((maleChampions.length > 0 ? maleChampions.length : 0) + (femaleChampions.length > 0 ? femaleChampions.length : 0)) > 0 && (
            <Badge className={`hidden sm:inline-flex ${ct.casinoBadge} ml-auto text-[9px]`}>
              {(maleChampions.length > 0 ? maleChampions.length : 0) + (femaleChampions.length > 0 ? femaleChampions.length : 0)} WEEK
            </Badge>
          )}
        </div>

        {/* Content — male and female side by side (or stacked on mobile) */}
        <div className="p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            {showMale && (
              <DivisionWeeklyChampions
                division="male"
                champions={maleChampions}
                totalWeeks={maleTotalWeeks}
                seasonProgressCompletedWeeks={maleCompletedWeeks}
                bare
                onPlayerClick={onPlayerClick}
              />
            )}
            {showFemale && (
              <DivisionWeeklyChampions
                division="female"
                champions={femaleChampions}
                totalWeeks={femaleTotalWeeks}
                seasonProgressCompletedWeeks={femaleCompletedWeeks}
                bare
                onPlayerClick={onPlayerClick}
              />
            )}
          </div>
        </div>
      </Card>
    );
  }

  /* ─── Single division selected (male or female) with data ─── */
  return (
    <div className="grid grid-cols-1 gap-5">
      {showMale && (
        <DivisionWeeklyChampions
          division="male"
          champions={maleChampions}
          totalWeeks={maleTotalWeeks}
          seasonProgressCompletedWeeks={maleCompletedWeeks}
          onPlayerClick={onPlayerClick}
        />
      )}
      {showFemale && (
        <DivisionWeeklyChampions
          division="female"
          champions={femaleChampions}
          totalWeeks={femaleTotalWeeks}
          seasonProgressCompletedWeeks={femaleCompletedWeeks}
          onPlayerClick={onPlayerClick}
        />
      )}
    </div>
  );
}
